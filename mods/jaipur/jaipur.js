const GameTemplate = require('../../lib/templates/gametemplate');
const GameRulesTemplate = require("./lib/game-rules.template");
const GameOptionsTemplate = require("./lib/game-options.template");


//////////////////
// CONSTRUCTOR  //
//////////////////
class Jaipur extends GameTemplate {

  constructor(app) {
    super(app);

    this.app             = app;

    this.name  		       = "Jaipur";

    this.description     = `${this.name} is a fast-paced two player card game where players acquire sets of resources to sell for the maximum profit.`;
    this.status          = "Alpha";
    
    //this.card_height_ratio = 1.6; // height is 1.6x width

    this.interface     = 1; //Display card graphics
    this.minPlayers 	 = 2;
    this.maxPlayers 	 = 2;

    this.card_img_dir = "/jaipur/img";
    this.categories 	 = "Games Boardgame Cardgame";

  }



  returnWelcomeOverlay(){
   let html = `<div id="welcome_overlay" class="welcome_overlay splash_overlay rules-overlay">
           <img src="/${this.name.toLowerCase()}/img/welcome_splash.jpg"/>
               </div>`;
    return "";//html;
  }


 
 initializeHTML(app) {

    if (this.browser_active == 0) { return; }
    if (this.initialize_game_run) { return; }

    super.initializeHTML(app);

    this.menu.addMenuOption({
      text : "Game",
      id : "game-game",
      class : "game-game",
      callback : function(app, game_mod) {
      	game_mod.menu.showSubMenu("game-game");
      }
    });
   
    this.menu.addSubMenuOption("game-game", {
      text : "How to Play",
      id : "game-rules",
      class : "game-rules",
      callback : function(app, game_mod) {
         game_mod.menu.hideSubMenus();
         game_mod.overlay.show(game_mod.app, game_mod, game_mod.returnGameRulesHTML()); 
      }
    });


    this.menu.addChatMenu(app, this);

    this.menu.render(app, this);
    this.menu.attachEvents(app, this);

    this.log.render(app, this);
    this.log.attachEvents(app, this);

    this.cardfan.addClass("bighand");  

    this.playerbox.render(app, this);
    this.playerbox.attachEvents(app, this);
    this.playerbox.addClassAll("poker-seat-", true);
    this.playerbox.addStatus(); //enable update Status to display in playerbox

    this.scoreboard.render(app, this);
    this.scoreboard.attachEvents(app, this);
}


  ////////////////
  // initialize //
  ////////////////
initializeGame(game_id) {

  if (this.game.status != "") { this.updateStatus(this.game.status); }
  this.restoreLog();

  //
  // initialize
  //
  if (!this.game.state) {
    this.game.state = this.returnState();

    console.log("\n\n\n\n");
    console.log("---------------------------");
    console.log("---------------------------");
    console.log("------ INITIALIZE GAME ----");
    console.log("-----------Jaipur----------");
    console.log("---------------------------");
    console.log("---------------------------");
    console.log("\n\n\n\n");

    this.updateStatus("<div class='status-message' id='status-message'>Generating the Game</div>");
    this.initializeQueue();

  }

  if (this.browser_active){
     this.displayBoard();
     this.displayHand();
     this.displayScore();

  }
 
}


initializeQueue(first_player = 1){
    this.game.queue = [];
    this.game.queue.push(`turn\t${first_player}`);
    this.game.queue.push("READY");
    this.game.queue.push("disclose_camels\t1");
    this.game.queue.push("disclose_camels\t2");
    this.game.queue.push("init");

    //Bonus Tokens
    this.game.queue.push(`DECKANDENCRYPT\t4\t2\t` + JSON.stringify(this.returnBonusTiles(5)));
    this.game.queue.push(`DECKANDENCRYPT\t3\t2\t` + JSON.stringify(this.returnBonusTiles(4)));
    this.game.queue.push(`DECKANDENCRYPT\t2\t2\t` + JSON.stringify(this.returnBonusTiles(3)));

    //Main Deck
    this.game.queue.push("marketdeal");
    this.game.queue.push("POOLDEAL\t1\t2\t1");
    this.game.queue.push("SIMPLEDEAL\t5\t1\t"+JSON.stringify(this.returnCards()));

}


  //
  // Core Game Logic
  //
  handleGameLoop() {

    let we_self = this;
    
    this.saveGame(this.game.id);
    ///////////
    // QUEUE //
    ///////////
    if (this.game.queue.length > 0) {

      if (this.browser_active){
         this.displayBoard();
         this.displayHand();
         this.displayScore();
      }

      let qe = this.game.queue.length-1;
      let mv = this.game.queue[qe].split("\t");

      /*
      Copy players hand into state.hand
      Move pool into state.market
      */
      if (mv[0] == "init") {
        this.game.queue.splice(qe, 1);

        while (this.game.deck[0].hand.length > 0){
          let card = this.game.deck[0].hand.pop();
          card = this.game.deck[0].cards[card].type;
          if (card == "camel"){
            this.game.state.herd++;
          }else{
            this.game.state.hand.push(card);
          }
        }
      }

      if (mv[0] == "disclose_camels"){
        let player = parseInt(mv[1]);
        this.game.queue.splice(qe, 1);

        if (this.game.player == player){
          this.addMove(`my_camels\t${player}\t${this.game.state.herd}`);
          this.endTurn();
        }
        return 0;
      }

      if (mv[0] == "my_camels"){
        let player = parseInt(mv[1]);
        let camCt = parseInt(mv[2]);
        if (this.game.player !== player){
          this.game.state.enemyherd = camCt;
          this.game.state.enemyhand -= camCt;
        }
        this.game.queue.splice(qe, 1);
      }

      if (mv[0] == "marketdeal"){
        this.game.queue.splice(qe, 1);

        while (this.game.pool[0].hand.length > 0){
          let card = this.game.pool[0].hand.pop();
          this.game.state.market.push(this.game.deck[0].cards[card].type);
        }

      }

      if (mv[0] == "revealbonus"){
       let player = parseInt(mv[1]);
        this.game.queue.splice(qe, 1);

        if (this.game.player == player){
          let tokens = [];
          for (let i = 1; i < 4; i++){
            while(this.game.deck[i].hand.length > 0){
              let token = this.game.deck[i].hand.pop();
              console.log(`Deck ${i}, token: ${token}, value: ${this.game.deck[i].cards[token]}`);
              tokens.push(this.game.deck[i].cards[token]);
            }
          }
          this.game.state.mybonustokens = tokens;
          this.addMove(`mybonus\t${player}\t${JSON.stringify(tokens)}`);
          this.endTurn();
        }
        return 0; 
      }

      if (mv[0] == "mybonus"){
        let player = parseInt(mv[1]);
        let tokens = JSON.parse(mv[2]);
        if (this.game.player !== player){
          this.game.state.enemytokens = tokens;
          if (tokens.length !== this.game.state.enemybonus){
            console.log("Bonus token mismatch");
          }
        }
        this.game.queue.splice(qe, 1);
      }

      if (mv[0] == "endround"){
        let winner = 0;
        let myscore = this.game.state.mybonustokens.reduce((a,b)=>a+b);
        myscore += this.game.state.vp[this.game.player - 1];
        myscore += (this.game.state.herd > this.game.state.enemyherd) ? 5 : 0;

        let opponent_score = this.game.state.enemytokens.reduce((a,b)=>a+b);
        opponent_score += this.game.state.vp[2 - this.game.player];
        opponent_score += (this.game.state.enemyherd > this.game.state.herd) ? 5 : 0;        

        this.updateLog(`You scored ${myscore} points versus ${opponent_score} for your opponent`);
        let method = "score";
        if (myscore > opponent_score){
          winner = this.game.player;
        }else if (opponent_score > myscore){
          winner = 3 - this.game.player;
        }else{
          this.updateLog(`It's a tie!`);
          method = "bonus token count";
          if (this.game.state.mybonustokens.length > this.game.state.enemytokens.length){
            winner = this.game.player;
          }else if (this.game.state.mybonustokens.length < this.game.state.enemytokens.length){
            winner = 3 - this.game.player;
          }
        }
        if (!winner){
          this.updateLog(`Both players have ${this.game.state.mybonustokens.length} bonus tokens, checking second tiebreaker...`);
          winner = (this.game.state.goodtokens[2] > this.game.state.goodtokens[1])? 2 : 1;
          method = "good token count";
        }

        let my_name = (this.game.player == winner) ? "You win" : "Your opponent wins";
        this.updateLog(`${my_name} the round by ${method}`); 

        if (this.game.state[`winner${winner}`]){
          this.endGame(this.game.players[winner-1], "excellence");
          return 0;
        }else{
          this.initializeQueue(3-winner);            
        }

        let temp = this.game.state[`winner${3-winner}`];
        this.game.state = this.returnState();
        this.game.state[`winner${winner}`] = 1;
        if (temp){
          this.game.state[`winner${3-winner}`] = 1;
        }

        this.game.queue.push(`ACKNOWLEDGE\t${my_name} the round by ${method}`);

        return 1;

      }

      if (mv[0] == "turn"){
        if (!this.browser_active) {return 0;}

        //For the beginning of the game only...
        if (this.game.state.welcome == 0) {
          try {
            this.overlay.show(this.app, this, this.returnWelcomeOverlay());
            document.querySelector(".welcome_overlay").onclick = () => { this.overlay.hide(); };
          } catch (err) {}
          this.game.state.welcome = 1;
        }

        if (this.gameOver()){
          this.game.queue.push("endround");
          this.game.queue.push("revealbonus\t1");
          this.game.queue.push("revealbonus\t2");
          this.updateLog("End of round. Determining winner...");

          return 1;
        }


        let player = parseInt(mv[1]);
        if (this.game.player == player){
          this.playerTurn();
        }else{
          //this.sortHand();
          this.updateStatus(`Waiting for opponent to play`);
        }
        return 0;
      }

      if (mv[0] == "take"){
        let player = parseInt(mv[1]);
        let card = mv[2];

        this.game.queue.splice(qe, 2);
        this.game.queue.push("turn\t"+(3-player));

        for (let i = 0; i < this.game.state.market.length; i++){
          if (this.game.state.market[i] == card){
            this.game.state.market.splice(i,1);
            break;
          }
        }

        if (this.game.player == player){
          this.game.state.hand.push(card);
        }else{
          this.game.state.enemyhand++;
        }

        let my_name = (this.game.player == player) ? "You" : "Your opponent";
        this.updateLog(`${my_name} took a ${card} from the market.`);

        this.game.queue.push("marketdeal");
        this.game.queue.push(`POOLDEAL\t1\t1\t1`);

      }

      if (mv[0] == "sell"){
        let player = parseInt(mv[1]);
        let card = mv[2];
        let count = parseInt(mv[3]);

        this.game.queue.splice(qe, 2);
        this.game.queue.push("turn\t"+(3-player));

        this.game.state.last_discard = card;

        if (this.game.player == player){
          this.game.state.hand = this.game.state.hand.filter( c => c !== card);
        }else{
          this.game.state.enemyhand -= count;
        }

        let good_token = 0;
        for (let i = 0; i < count; i++){
          if (this.game.state.tokens[card].length > 0){
            good_token++;
            let profit = this.game.state.tokens[card].pop();
            this.game.state.vp[player-1] += profit;
          }
        }

        let bonus_deck = 0;
        if (count >= 3){
          bonus_deck = Math.min(count-1, 4); //In case selling more than 5
          this.game.queue.push(`DEAL\t${bonus_deck}\t${player}\t1`);
          if (this.game.player !== player){
            this.game.state.enemybonus++;
          }
        }

        this.game.state.goodtokens[player-1] += good_token;

        let my_name = (this.game.player == player) ? "You" : "Your opponent";
        this.updateLog(`${my_name} sold ${count} ${card}${(count>1)?"s":""}, gaining ${good_token} goods token${(good_token>1)?"s":""}${(bonus_deck>0)?" and a bonus token":""}.`);

        this.displayScore();

      }

      if (mv[0] == "trade"){
        let player = parseInt(mv[1]);
        let from_market = JSON.parse(mv[2]);
        let to_market = JSON.parse(mv[3]);

        this.game.queue.splice(qe, 2);
        this.game.queue.push("turn\t"+(3-player));

        for (let i = 0; i < from_market.length; i++){
          console.log(JSON.stringify(this.game.state.hand),JSON.stringify(this.game.state.market));
          if (this.game.player === player){
            this.game.state.hand.push(from_market[i]);
          }else{
            this.game.state.enemyhand++;
          }

          for (let j = 0; j < this.game.state.market.length; j++){
            if (from_market[i] === this.game.state.market[j]){
              this.game.state.market.splice(j,1);
              break;
            }
          }
        }

        for (let i = 0; i < to_market.length; i++){
          console.log(JSON.stringify(this.game.state.hand),JSON.stringify(this.game.state.market));
          this.game.state.market.push(to_market[i]);
          if (this.game.player === player){
            if (to_market[i] === "camel"){
              this.game.state.herd--;
            }else{
              for (let j = 0; j < this.game.state.hand.length; j++){
                if (to_market[i] === this.game.state.hand[j]){
                  this.game.state.hand.splice(j,1);
                  break;
                }
              }
            }
          }else{
            if (to_market[i] === "camel"){
              this.game.state.enemyherd--;
            }else{
              this.game.state.enemyhand--;
            }
          }
        }

        let my_name = (this.game.player == player) ? "You" : "Your opponent";
        this.updateLog(`${my_name} traded ${to_market} for ${from_market}.`);

        console.log(JSON.stringify(this.game.state.hand),JSON.stringify(this.game.state.market));
      }


      if (mv[0] == "camels"){
        let player = parseInt(mv[1]);

        this.game.queue.splice(qe, 2);
        this.game.queue.push("turn\t"+(3-player));

        this.game.state.market = this.game.state.market.filter( card => card !== "camel");

        let numCamels = 5-this.game.state.market.length;

        if (this.game.player === player){
          this.game.state.herd += numCamels;
          this.updateLog(`You added ${numCamels} to your herd.`);
        }else{
          this.game.state.enemyherd += numCamels;
          this.updateLog(`Your opponent added ${numCamels} to their herd.`);
        }

        this.game.queue.push("marketdeal");
        this.game.queue.push(`POOLDEAL\t1\t${numCamels}\t1`);


      }

      return 1;
    } // if cards in queue
    
    return 0;

  }


  gameOver(){
    if (this.game.deck[0].crypt.length == 0){
      return true;
    }

    let emptyCt = 0;
    for (let token in this.game.state.tokens){
      if (this.game.state.tokens[token].length == 0){
        emptyCt++;
      }
    }

    return (emptyCt >= 3);
  }

  playerTurn(){
    let game_self = this;

    let html = `<div class="tbd">Your turn:</div> 
                  <ul>
                    <li class="option" id="take">take cards</li>
                    <li class="option" id="sell">sell cards</li>
                  </ul>
                `;
    
    this.updateStatus(html);

    $(".option").off();
    $(".option").on("click",  function () {
        let choice = $(this).attr("id");
        if (choice == "take"){
          game_self.playerTakeCard();
        }else{
          game_self.playerSellCard();
        }
    });
  }

  playerTakeCard(){
    let game_self = this;

    //Some sanity checks to make sure player can't end up with more than 7 cards
    let camel_cnt = this.game.state.market.filter(x => x === "camel").length;



    let html = `<div class="tbd">${(this.game.state.hand.length < 7 )? 'Take a card, or:' :'select one of the below:'}
                </div>
                   <ul>
                    ${(camel_cnt < 4)? '<li class="option" id="swap">trade cards</li>' :""}
                    ${(camel_cnt > 0) ? '<li class="option" id="camel">take all camels</li>' :''}
                    <li class="option" id="goback">go back</li>
                  </ul>
                `;
    
    this.updateStatus(html);

    $(".option").off();
    $(".option").on("click",  function () {
        $(".market .card").off();
        let choice = $(this).attr("id");
        if (choice == "swap"){
          game_self.pickMany();
        }else if (choice=="camel"){
          $(".option").off();
          game_self.addMove(`camels\t${game_self.game.player}`);
          game_self.endTurn();
        }else{
          game_self.playerTurn();
        }
    });

    if (this.game.state.hand.length < 7 ){
      $(".market .card").on("click", function(){
        $(".option").off();
        $(".market .card").off();
        let card = $(this).attr("data-id");
        if (card == "camel"){
          salert("You cannot take just one camel!");
          game_self.playerTakeCard();
          return;
        }

        game_self.addMove(`take\t${game_self.game.player}\t${card}`);
        game_self.endTurn();
      });
    }else{
      $(".market .card").on("click", function(){
        salert("Your hand is already full, trade or sell cards!");
      });
    }
  }


  pickMany(){
    //Let's first organize the resources
    let market = {};
    let hand = {};
    let to_give = [];
    let to_take = [];
    let game_self = this;

    for (let res of this.game.state.market){
      if (res !== "camel"){
        if (!market[res]){
          market[res] = 0;
        }
        market[res]++;
      }
    }
    for (let res of this.game.state.hand){
        if (!hand[res]){
          hand[res] = 0;
        }
        hand[res]++;
    }
    if (this.game.state.herd > 0 && (this.game.state.hand.length + to_take.length) < 7){
      hand["camel"] = this.game.state.herd;
    }

    let updateOverlay = () => {
      //Refresh available supply


      let html = `<div class="trade_overlay" id="trade_overlay">
                  <div class="grid_display">
                    <div class="market_overlay">
                      <div class="h2">Cards in Market:</div>
                      <div class="card_group">`;
      for (let r in market){
        if (!to_give.includes(r)){
          html += game_self.cardWithCountToHTML(r, market[r]);
        }else{
          html += game_self.cardWithCountToHTML(r, -market[r]);
        }
      }
      html += `</div></div> <div class="take_overlay">
                            <div class="h2">Take from Market:</div>
                            <div class="card_group">`;
      for (let r of to_take){
        html += game_self.cardToHTML(r);
      }
      html += `</div></div> <div class="hand_overlay">
                        <div class="h2">Cards in Hand:</div>
                        <div class="card_group">`;
      for (let r in hand){
        if (!to_take.includes(r) && (r !== "camel" || (game_self.game.state.hand.length + to_take.length) <= 7)){
          html += game_self.cardWithCountToHTML(r, hand[r]);
        }else{
          html += game_self.cardWithCountToHTML(r, -hand[r]);
        }
      }
      html += `</div></div> <div class="give_overlay">                            
                            <div class="h2">Give to Market:</div>
                            <div class="card_group">`;

      for (let r of to_give){
        html += game_self.cardToHTML(r);
      }
      html += `</div></div></div>
          <div class="trade_overlay_buttons">
            <div id="cancel_btn" class="trade_overlay_button saito-button-primary">Cancel</div>
            <div id="trade_btn" class="trade_overlay_button saito-button-primary disabled">Trade</div>
          </div>
        </div>
      `;
    
      game_self.overlay.show(game_self.app, game_self, html);
      game_self.overlay.blockClose();

      $(".market_overlay .card_count").on("click", (e)=>{
        let card = e.target.dataset.id;
        if (e.target.classList.contains("disabled") || !card){ return; }
        market[card]--;
        to_take.unshift(card);
        updateOverlay();
      });
      $(".hand_overlay .card_count").on("click", (e)=>{
        let card = e.target.dataset.id;
        if (e.target.classList.contains("disabled") || !card){ return; }
        hand[card]--;
        to_give.unshift(card);
        updateOverlay();
      });
      $(".take_overlay .card").on("click", (e)=>{
        let card = e.target.dataset.id;
        if (!card){ return; }
        market[card]++;
        to_take.splice(to_take.indexOf(card),1);
        updateOverlay();
      });
      $(".give_overlay .card").on("click", (e)=>{
        let card = e.target.dataset.id;
        if (!card){ return; }
        hand[card]++;
        to_give.splice(to_give.indexOf(card),1);
        updateOverlay();
      });


      if (to_give.length === to_take.length && to_give.length > 1){
        let submit = document.getElementById("trade_btn");
        submit.classList.remove("disabled");
        submit.onclick = () => {
          game_self.overlay.remove();
          game_self.addMove(`trade\t${game_self.game.player}\t${JSON.stringify(to_take)}\t${JSON.stringify(to_give)}`);
          game_self.endTurn();
        };
      }

      $("#cancel_btn").on("click", ()=>{
        game_self.overlay.remove();
        game_self.playerTurn();
      });

    };

    updateOverlay();
  }


  playerSellCard(){
    let game_self = this;
    //Organize hand
    let available_resources = {};
    for (let card of this.game.state.hand){
      if (!available_resources[card]){
        available_resources[card] = 0;
      }
      available_resources[card]++;
    }

    let expensive = ["diamond", "gold", "silver"];

    let html = `<div class="tbd">Sell what good: </div><ul>`;
    for (let r in available_resources){
      if (expensive.includes(r) && available_resources[r] < 2){
        continue;
      }
      html += `<li class="option" id="${r}">${r} (${available_resources[r]})</li>`;
    }
    html += ` <li class="option" id="goback">go back</li>
              </ul>`;

    this.updateStatus(html);

    $(".option").off();
    $(".option").on("click",  function () {
        $(".option").off();
        let choice = $(this).attr("id");
        if (choice == "goback"){
          game_self.playerTurn();
          return;
        }

        game_self.addMove(`sell\t${game_self.game.player}\t${choice}\t${available_resources[choice]}`);
        game_self.endTurn();
    });
  }


  cardToHTML(card){
    if (card){
      return `<img class="card" data-id="${card}" src="${this.card_img_dir}/${card}.png">`;  
    }else{
      return "";
    }
    
  }

  cardWithCountToHTML(card, amt){
    if (amt !== 0){
      return `<div class="card_count${(amt < 0)?" disabled":""}" data-id="${card}" style="background-image:url('/jaipur/img/${card}.png');">${Math.abs(amt)}</div>`;  
    }else{
      return "";
    }
  }

  camelHTML(herd1, herd2){
    let camel_bonus = (herd1 > herd2) ? `<img class="camel_bonus" src="/jaipur/img/tokens/Tokens Camel 5 Points.jpg" />` : "";
    if (herd1 > 0){
      return `<div class="camel_train card_count">${herd1}${camel_bonus}</div>`;
    }else{
      return "";
    }
  }

  displayHand(){
    let html = "";

    this.game.state.hand.sort();

    for (let c of this.game.state.hand){
      html += this.cardToHTML(c);
    }
    this.cardfan.render(this.app, this, html);

    this.playerbox.refreshGraphic(this.camelHTML(this.game.state.herd, this.game.state.enemyherd), this.game.player);
    this.playerbox.refreshGraphic(this.camelHTML(this.game.state.enemyherd, this.game.state.herd), 3-this.game.player);

    html = `<div class="pb_info">${this.game.state.enemyhand} cards</div>`;
    if (this.game.state.enemybonus>0){
      html += `<div class="pb_sub_info">${this.game.state.enemybonus} bonus token${(this.game.state.enemybonus > 1)?"s":""}</div>`;
    }
    this.playerbox.refreshInfo(html, 3-this.game.player);

  }


  displayBoard(){
    let html = `<div class="jaipur_board">`;
        

    html += `<div class="bonus_tokens">`;
    for (let token in this.game.state.tokens){
      if (this.game.state.tokens[token].length > 0){
        let value = this.game.state.tokens[token].pop();
        html += `<img class="token" src="/jaipur/img/tokens/Tokens ${token} ${value} Points.jpg"/>`;
        this.game.state.tokens[token].push(value);      
      }else{
        html += `<img class="token" src="/jaipur/img/tokens/empty.jpg"/>`;
      }
    }
    for (let i = 3; i <= 5; i++){
      if (this.game.deck[i-2].crypt.length > 0){
        html += `<img class="token" src= "/jaipur/img/tokens/${i} cards bonus tokens front.jpg" />`;
      }else{
        html += `<img class="token" src="/jaipur/img/tokens/empty.jpg"/>`;
      }
    }

    html += "</div>";

    html += `<div class="draw_decks">
                <div id="draw" class="tip card_count">
                  ${this.game.deck[0].crypt.length}
                  <div class="tiptext">${this.game.deck[0].crypt.length} cards left in draw pile.</div>
                </div>
                <div id="discard">${this.cardToHTML(this.game.state.last_discard)}</div>
              </div>`;

    html +=`<div class="market">`;
    for (let res of this.game.state.market){
      html += this.cardToHTML(res);
    }

    html += `</div>
          </div>`;

    $(".gameboard").html(html);

  }


  displayScore(){
    let html = "";

    console.log(this.game.state.vp);

    let my_score = (this.game.state.herd > this.game.state.enemyherd) ? 5:0;
    my_score +=   this.game.state.vp[this.game.player-1];
    let bonus = this.game.deck[1].hand.length + this.game.deck[2].hand.length + this.game.deck[3].hand.length;
    let bonus_text = (bonus>0)? `*<div class="tiptext">Score does not included ${bonus} bonus token(s).</div>`: "";
    html += `<div class="score tip">Me: ${my_score}${bonus_text}</div>`;

    let enemy_score = (this.game.state.herd < this.game.state.enemyherd) ? 5:0;
    enemy_score += this.game.state.vp[2 - this.game.player];
    bonus_text = (this.game.state.enemybonus>0)? `*<div class="tiptext">Score does not included ${this.game.state.enemybonus} bonus token(s).</div>`: "";
    html += `<div class="score tip">Opponent: ${enemy_score}${bonus_text}</div>`;
 
    this.scoreboard.update(html);
  }



  ////////////////////
  // Core Game Data //
  ////////////////////
  returnState() {

    let state = {};
    state.market = ["camel", "camel", "camel"];
    state.hand = [];
    state.herd = 0;
    state.enemyherd = 0;
    state.enemyhand = 5;
    state.vp = [0, 0];
    state.enemybonus = 0;
    state.goodtokens = [0, 0];

    state.tokens = {cloth: [1, 1, 2, 2, 3, 3, 5],
                    leather:[1, 1, 1, 1, 1, 1, 2, 3, 4],
                    spice:[1, 1, 2, 2, 3, 3, 5],
                    silver:[5, 5, 5, 5, 5],
                    gold:[5, 5, 5, 6, 6],
                    diamond:[5, 5, 5, 7, 7],
                  };
      
    return state;
    

  }


  returnCards() {

    var deck = {};

    let definition = { diamond: 6, gold: 6, silver: 6, cloth: 8, spice: 8, leather: 10, camel: 8};
    for (let res in definition){
      for (let i = 0; i < definition[res]; i++){
        deck[`${res}${i}`] = { type: res };
      }
    }

    return deck;

  }


  returnBonusTiles(set){
    let start = 1;
    if (set == 4) { start = 4;}
    if (set == 5) { start = 8;}

    let deck = {};
    let idx = 1;
    for (let i = 0; i < 3; i++){
      for (let j = 0; j < 2; j++){
        deck[idx] = start;
        idx++;
      }
      start++;
    }

    console.log(JSON.parse(JSON.stringify(deck)));
    return deck;
  }

  returnGameRulesHTML(){
    return GameRulesTemplate(this.app, this);
  }

  returnGameOptionsHTML(){
    return GameOptionsTemplate(this.app, this);
  }


} // end Jaipur class

module.exports = Jaipur;



