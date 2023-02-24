var saito = require('../../lib/saito/saito');
var GameTemplate = require('../../lib/templates/gametemplate');
const SolitrioGameRulesTemplate = require("./lib/solitrio-game-rules.template");
const SolitrioGameOptionsTemplate = require("./lib/solitrio-game-options.template");


//////////////////
// CONSTRUCTOR  //
//////////////////
class Solitrio extends GameTemplate {

  constructor(app) {

    super(app);

    this.name            = "Solitrio";
    this.gamename        = "Solitrio";
    this.slug            = "solitrio";
    this.game_length     = 5; //Estimated number of minutes to complete a game
    this.description     = 'Once you\'ve started playing Solitrio, how can you go back to old-fashioned Solitaire? This one-player card game is the perfect way to pass a flight from Hong Kong to pretty much anywhere. Arrange the cards on the table from 2-10 ordered by suite. Harder than it looks.';
    this.categories      = "Games Cardgame One-player";

    this.maxPlayers      = 1;
    this.minPlayers      = 1;
    this.app = app;
  }


  // Create an exp league by default
  respondTo(type){
    if (type == "default-league") {
      let obj = super.respondTo(type);
      obj.ranking_algorithm = "EXP";
      obj.default_score = 0;
      return obj;
    }
    return super.respondTo(type);
  }


  returnGameRulesHTML(){
    return SolitrioGameRulesTemplate(this.app, this);
  }


  
  //Single player games don't allow game-creation and options prior to join
  returnGameOptionsHTML() {
    return SolitrioGameOptionsTemplate(this.app, this);
  }


  initializeGame(game_id) {
    console.log("SET WITH GAMEID: " + game_id);

    if (!this.game.state) {
      console.log("******Generating the Game******");
      this.game.state = this.returnState();
      this.game.queue = [];
      this.game.queue.push("round");
      this.game.queue.push("READY");
    }
    
    console.log(JSON.parse(JSON.stringify(this.game)));

    if (this.browser_active){
      $('.slot').css('min-height', $('.card').css('min-height'));  
    }
  }

  newRound(){
    //Set up queue
    this.game.queue = [];
    this.game.queue.push("play");
    this.game.queue.push("DEAL\t1\t1\t40");
    this.game.queue.push("SHUFFLE\t1\t1");
    this.game.queue.push("DECK\t1\t"+JSON.stringify(this.returnDeck()));

    //Clear board
    this.game.board = {};

    //Reset/Increment State
    this.game.state.round++;
    this.game.state.recycles_remaining = 2;
  }


  initializeHTML(app) {
    //console.trace("Initialize HTML");
    if (!this.browser_active) { return; }
    
    super.initializeHTML(app);

    //
    // ADD MENU
    //
    this.menu.addMenuOption("game-game", "Game");
    this.menu.addMenuOption("game-info", "Info");

    this.menu.addSubMenuOption("game-game",{
      text : "Start New Game",
      id : "game-new",
      class : "game-new",
      callback : function(app, game_mod) {
        game_mod.menu.hideSubMenus();
        game_mod.endGame();
        game_mod.newRound();
        game_mod.endTurn();
      }
    });
    this.menu.addSubMenuOption("game-game", {
      text : "Play Mode",
      id : "game-play",
      class : "game-play",
      callback : function(app, game_mod) {
        game_mod.menu.showSubSubMenu("game-play"); 
      }
    });


    this.menu.addSubMenuOption("game-play",{
      text: `Auto ${(this.game.options.play_mode=="auto")?"✔":""}`,
      id:"game-confirm-newbie",
      class:"game-confirm-newbie",
      callback: function(app,game_mod){
        game_mod.game.options["play_mode"] = "auto";
        game_mod.attachEventsToBoard(); //change the click style
        try{
          document.querySelector("#game-confirm-newbie").textContent = "Auto ✔";
          document.querySelector("#game-confirm-expert").textContent = "Manual";   
        }catch(err){}
      }
    });
   
    this.menu.addSubMenuOption("game-play",{
      text: `Manual ${(this.game.options.play_mode=="auto")?"":"✔"}`,
      id:"game-confirm-expert",
      class:"game-confirm-expert",
      callback: function(app,game_mod){
       game_mod.game.options["play_mode"] = "manual";
       game_mod.attachEventsToBoard(); //change the click style
       try{
        document.querySelector("#game-confirm-newbie").textContent = "Auto";
        document.querySelector("#game-confirm-expert").textContent = "Manual ✔";  
       }catch(err){}
      }
    });


    this.menu.addSubMenuOption("game-info", {
      text : "How to Play",
      id : "game-intro",
      class : "game-intro",
      callback : function(app, game_mod) {
        game_mod.menu.hideSubMenus();
        game_mod.overlay.show(game_mod.returnGameRulesHTML());
      }
    });

    this.menu.addSubMenuOption("game-info", {
      text : "Stats",
      id : "game-stats",
      class : "game-stats",
      callback : function(app, game_mod) {
        game_mod.menu.hideSubMenus();
        game_mod.overlay.show(game_mod.returnStatsHTML());
      }
    });

    this.menu.addChatMenu();
    this.menu.render();


  }


  returnState() {

    let state = {};

    state.round = 0;
    state.wins = 0;
    state.recycles_remaining = 2;

    return state;

  }

  exitGame(){
    this.updateStatusWithOptions("Saving game to the blockchain...");
    this.prependMove("exit_game\t"+this.game.player);
    this.endTurn();
  }

  returnStatsHTML(){
    let html = `<div class="rules-overlay">
    <h1>Game Stats</h1>
    <table>
    <tbody>
    <tr><th>Games Played:</th><td>${this.game.state.round-1}</td></tr>
    <tr><th>Games Won:</th><td>${this.game.state.wins}</td></tr>
    <tr><th>Win Percentage:</th><td>${(this.game.state.round>1)? Math.round(1000* this.game.state.wins / (this.game.state.round-1))/10 : 0}%</td></tr>
    </tbody>
    </table>
    </div>`;
    return html;
  }

  checkBoardStatus(){
    //Use recycling function to check if in winning state
    this.displayUserInterface();

    if (this.scanBoard(false)) {
      this.displayModal("Congratulations!", "You win the deal!");
      this.prependMove("win");
      this.endTurn();
    }else if (!this.hasAvailableMoves()){
      if (this.game.state.recycles_remaining == 0){
        this.displayWarning("Game over", "There are no more available moves to make.", 9000);
        //salert("No More Available Moves, you lose!");
      }else{
        this.shuffleFlash();
      }
    }
  }

  attachEventsToBoard(){
    console.log(this.game.options);
    if (this.game.options.play_mode == "auto"){
      this.attachEventsToBoardAutomatic();
    }else{
      this.attachEventsToBoardManual();
    }
  }

  attachEventsToBoardAutomatic(){
    let solitrio_self = this;

    $('.slot').off();
    $('.slot').on('click', function() {

      let card = $(this).attr("id");

      if (solitrio_self.game.board[card][0] === "E") {
        solitrio_self.displayWarning("Invalid Move", "You need to select a card");
        return;
      }

      solitrio_self.toggleCard(card);
      let slot = solitrio_self.dynamicColoring(card);

      if (slot) {
        //card = selected, slot = card
        solitrio_self.prependMove(`move\t${card}\t${slot}`);
          
        let x = JSON.stringify(solitrio_self.game.board[card]);
        let y = JSON.stringify(solitrio_self.game.board[slot]);

        solitrio_self.game.board[card] = JSON.parse(y);
        solitrio_self.game.board[slot] = JSON.parse(x);
        
        solitrio_self.untoggleCard(card);
     
        $("#"+card).html(solitrio_self.returnCardImageHTML(solitrio_self.game.board[card]));
        $("#"+slot).html(solitrio_self.returnCardImageHTML(solitrio_self.game.board[slot]));
        $("#"+card).toggleClass("empty");
        $("#"+slot).toggleClass("empty");
        
        solitrio_self.checkBoardStatus();

        } else {
          solitrio_self.displayWarning("Invalid Move", "There is nowhere to move that card");
          //salert("<p>Sorry, You can't move that card anywhere");
          solitrio_self.untoggleCard(card);
        }
      
      
    });

  }

  attachEventsToBoardManual() {
    let solitrio_self = this;
    let selected = "";                // prev selected

    $('.slot').off();
    $('.slot').on('click', function() {

      let card = $(this).attr("id");

      if (selected === card) { //Selecting same card again
        solitrio_self.untoggleCard(card);
        selected = "";
        $("#rowbox").removeClass("selected");
        return;
      }else {
        if (!selected) { //New Card
          if (solitrio_self.game.board[card][0] !== "E") {
            selected = card;
            solitrio_self.toggleCard(card);
            $("#rowbox").addClass("selected");
            solitrio_self.dynamicColoring(selected);
            return;
          } 
        }else{
          //Change selection
          if (solitrio_self.game.board[card][0]!=="E"){ 
            solitrio_self.untoggleCard(selected);
            solitrio_self.toggleCard(card);
            selected=card;
            solitrio_self.dynamicColoring(selected);
            return;
          } 

        // Move card to empty slot if it is legal
        // selected must work in this context
        if (solitrio_self.canCardPlaceInSlot(selected, card)) {
          solitrio_self.prependMove(`move\t${selected}\t${card}`);
          //solitrio_self.endTurn();
            
          let x = JSON.stringify(solitrio_self.game.board[selected]);
          let y = JSON.stringify(solitrio_self.game.board[card]);

          solitrio_self.game.board[selected] = JSON.parse(y);
          solitrio_self.game.board[card] = JSON.parse(x);
          
          solitrio_self.untoggleCard(card);
          solitrio_self.untoggleCard(selected);
       
          $("#"+selected).html(solitrio_self.returnCardImageHTML(solitrio_self.game.board[selected]));
          $("#"+card).html(solitrio_self.returnCardImageHTML(solitrio_self.game.board[card]));
          $("#"+selected).toggleClass("empty");
          $("#"+card).toggleClass("empty");
          $("#rowbox").removeClass("selected");
          selected = "";
          
          //Use recycling function to check if in winning state
          solitrio_self.displayUserInterface();

          if (solitrio_self.scanBoard(false)) {
            //salert("Congratulations! You win!");
            solitrio_self.displayModal("Congratulations!", "You win the deal!");
            solitrio_self.prependMove("win");
            solitrio_self.endTurn();
          }else if (!solitrio_self.hasAvailableMoves()){
            if (solitrio_self.game.state.recycles_remaining == 0){
              solitrio_self.displayWarning("Game over", "There are no more available moves to make.", 9000);
              //salert("No More Available Moves, you lose!");
            }else{
              solitrio_self.shuffleFlash();
            }
          }
          return;
  
        } else {
          //SmartTip, slightly redundant with internal logic of canCardPlaceInSlot
          let smartTip;
          let predecessor = solitrio_self.getPredecessor(card);
          if (predecessor){
            let cardValue = parseInt(solitrio_self.returnCardNumber(predecessor))+1;
            if (cardValue < 11)
              smartTip = "Hint: Try a "+cardValue+" of "+solitrio_self.cardSuitHTML(solitrio_self.returnCardSuite(predecessor));
            else smartTip = "Unfortunately, no card can go there";
          }else{
            smartTip = "Hint: Try a 2 of any suit";
          }
          //Feedback
          solitrio_self.displayWarning("Invalid Move", "Sorry, "+solitrio_self.cardSuitHTML(solitrio_self.returnCardSuite(selected))+solitrio_self.returnCardNumber(selected)+" cannot go there... ");
          //salert("Sorry, "+solitrio_self.cardSuitHTML(solitrio_self.returnCardSuite(selected))+solitrio_self.returnCardNumber(selected)+" cannot go there... </p><p>"+smartTip+"</p>");
          solitrio_self.untoggleCard(selected);
          selected = "";
          $("#rowbox").removeClass("selected");
          return;
        }
      }
      }
    });
  }

  shuffleFlash(){
    
    $("#shuffle")
      .css("color", "#000")
      .css("background", "#FFF6")
      .delay(300)
      .queue(function () {
        $(this).css("color", "#FFF").css("background", "#0004").dequeue();
      })
      .delay(300)
      .queue(function () {
        $(this).css("color", "#000").css("background", "#FFF6").dequeue();
      })
      .delay(300)
      .queue(function () {
        $(this).css("color", "#FFF").css("background", "#0004").dequeue();
      })
      .delay(300)
      .queue(function () {
        $(this).css("color", "#000").css("background", "#FFF6").dequeue();
      })
      .delay(300)
      .queue(function () {
        $(this).css("color", "#FFF").css("background", "#0004").dequeue();
      })
      .delay(300)
      .queue(function () {
        $(this).css("color", "#000").css("background", "#FFF6").dequeue();
      })
      .delay(300)
      .queue(function () {
        $(this).css("color", "#FFF").css("background", "#0004").dequeue();
      })
      .delay(300)
      .queue(function () {
        $(this).css("color", "#000").css("background", "#FFF6").dequeue();
      })
      .delay(300)
      .queue(function () {
        $(this).removeAttr("style").dequeue();
      });
  }

  dynamicColoring(card){
    let solitrio_self = this;
    let availableSlot = null;
    $(".valid").removeClass("valid");
    $(".invalid").removeClass("invalid");

    $(".empty").each(function(){
      if (solitrio_self.canCardPlaceInSlot(card, $(this).attr("id"))){
        availableSlot = $(this).attr("id");
        $(this).addClass("valid");
      }else{
        $(this).addClass("invalid");
      }
    });
    return availableSlot;
  }


  /*
  Card: Previously selected card 
  Slot: empty slot
  Both expressed by position "row[1-4]_slot[1-10]"
  */
  canCardPlaceInSlot(card, slot) {
    let cardValue = this.returnCardNumber(card); 
    let cardSuit = this.returnCardSuite(card);

    let predecessor = this.getPredecessor(slot);

    if (predecessor){
      let predecessorValueNum = parseInt(this.returnCardNumber(predecessor));
      let predecessorSuit = this.returnCardSuite(predecessor); 
      if (cardValue == (predecessorValueNum+1) && cardSuit === predecessorSuit)
        return true; 
    }else{ //No predecessor, i.e. first position in row
      if (cardValue === '2')
        return true;
    }    
    return false;
  }

/*
  Return previous position in row for a given coordinate, false if no predecessor
*/
  getPredecessor(cardPos){
    let tempArr = cardPos.split("_slot");
    if (tempArr[1] === "1")
      return false;
    else
      return tempArr[0]+"_slot"+(tempArr[1]-1);
  }

  /* scan board to see if any legal moves available*/
  hasAvailableMoves(){
    
    for (let i = 1; i <= 4; i++) {
      let prevNum = "none";
      for (let j = 1; j <= 10; j++) {
        let slot  = `row${i}_slot${j}`;
        let suite = this.returnCardSuite(slot);  
        if (suite === "E"){
          if (prevNum != "10")
            return true;
          prevNum = "10"; //Empty slot counts as a 10 because it is "blocking"
        } else prevNum = this.returnCardNumber(slot);
      }
    }
    return false;
  }

  toggleCard(divname) {
    divname = '#' + divname;
    $(divname).css('opacity', '0.75');
  }

  untoggleAll(){
    $(".slot").css("opacity","1.0");
  }

  untoggleCard(divname) {
    divname = '#' + divname;
    $(divname).css('opacity', '1.0');
  }

  hideCard(divname){
    divname = '#' + divname;
    $(divname).css('opacity', '0.0'); 
  }

  /* Copy hand into board*/
  handToBoard(){
    let indexCt = 0;
    for (let i = 1; i <= 4; i++)
      for (let j = 1; j<= 10; j++){
        let position = `row${i}_slot${j}`;
        this.game.board[position] = this.game.deck[0].cards[this.game.deck[0].hand[indexCt++]];
      }
  }

  boardToHand(){
    let indexCt = 0;
    for (let position in this.game.board){
      this.game.deck[0].hand[indexCt++] = this.game.board[position];
    }
  }

  parseIndex(slot){
    let coords = slot.split("_");
    let x = coords[0].replace("row","");
    let y = coords[1].replace("slot","");
    return 10*(parseInt(x)-1)+parseInt(y)-1;
  }

  handleGameLoop(msg=null) {

    this.saveGame(this.game.id);
    ///////////
    // QUEUE //
    ///////////
    if (this.game.queue.length > 0) {

      let qe = this.game.queue.length-1;
      let mv = this.game.queue[qe].split("\t");
      let shd_continue = 1;

      console.log(JSON.stringify(mv));

      if (mv[0] === "round") {
        this.newRound();
      }

      if (mv[0] === "win"){
        this.game.state.wins++;
        this.endGame(this.app.wallet.returnPublicKey());
        this.newRound();
      }

      if (mv[0] === "play") {
        //this.game.queue.splice(qe, 1);
        if (this.browser_active){
          this.handToBoard();        
          this.displayBoard();
          this.displayUserInterface();  
        }        
        return 0;
      }

      if (mv[0] === "exit_game"){
        this.game.queue.splice(qe, 1);
        let player = parseInt(mv[1])
        this.saveGame(this.game.id);

        if (this.game.player === player){
          super.exitGame();
          //window.location.href = "/arcade";
        }else{
          this.updateStatus("Player has exited the building");
        }
        return 0;
      }

      if (mv[0] === "shuffle"){
        this.game.queue.splice(qe, 1);
        this.scanBoard(true);
        this.game.state.recycles_remaining--;
        return 1;
      }
      
      if (mv[0] === "move"){
        this.game.queue.splice(qe, 1);
        let card = mv[1];     //rowX_slotY
        let emptySlot = mv[2];//rowX_slotY

        let x = this.parseIndex(card);
        let y = this.parseIndex(emptySlot);

        let temp = this.game.deck[0].hand[x];
        this.game.deck[0].hand[x] = this.game.deck[0].hand[y];
        this.game.deck[0].hand[y] = temp;
        return 1;
      }

      //
      // avoid infinite loops
      //
      if (shd_continue == 0) { 
        console.log("NOT CONTINUING");
        return 0; 
      }

    } 
    return 1;
  }

  undoMove(){
    let mv = this.moves.shift().split("\t");
    let card = mv[1];
    let selected = mv[2];

    let x = JSON.stringify(this.game.board[selected]);
    let y = JSON.stringify(this.game.board[card]);

    this.game.board[selected] = JSON.parse(y);
    this.game.board[card] = JSON.parse(x);
       
    $("#"+selected).html(this.returnCardImageHTML(this.game.board[selected]));
    $("#"+card).html(this.returnCardImageHTML(this.game.board[card]));
    $("#"+selected).toggleClass("empty");
    $("#"+card).toggleClass("empty");
    $("#rowbox").removeClass("selected");
    this.untoggleAll();
    this.displayUserInterface();
  }


  async displayBoard(timeInterval = 0) {

    if (this.browser_active == 0) { return; }
    $(".slot").removeClass("empty");
    try {
      //Want to add a timed delay for animated effect
      const timeout = ms => new Promise(res => setTimeout(res, ms));
      
        for (let i in this.game.board) {
        await timeout(timeInterval);
        let divname = '#'+i;
        $(divname).html(this.returnCardImageHTML(this.game.board[i]));
        this.untoggleCard(i);
        if (this.game.board[i][0]=="E"){
          $(divname).addClass("empty");
        }
      }
      
    } catch (err) {
    }

    this.attachEventsToBoard();
  }

/*
no status atm, but this is to update the hud
*/
  displayUserInterface() {

    let solitrio_self = this;

    let html = '<span class="hidable">Arrange the cards from 2 to 10, one suit per row by moving cards into empty spaces.</span>'; 
    let option = `<ul><li class="menu_option"`;
    if (this.game.state.recycles_remaining > 0) {
      html += '<span>You may shuffle the unarranged cards ';
      if (this.game.state.recycles_remaining == 2) { 
       html += '<strong>two</strong> more times.'; 
      }else{
       html += '<strong>one</strong> more time.';  
      }
      html += "</span>";
      option += ` id="shuffle">Shuffle cards`;
    }else{
      option += ` id="quit">Start New Game`;
    }
    if (this.moves.length > 0){
      option += `</li><li class="menu_option" id="undo">Undo`;
    }

    option += "</li></ul>";
    
    this.updateStatusWithOptions(html,option);        


    $('.menu_option').off();
    $('.menu_option').on('click', function() {
      let action = $(this).attr("id");

      if (action == "shuffle"){
        solitrio_self.updateStatusWithOptions("shuffle cards...");
        solitrio_self.prependMove("shuffle");
        solitrio_self.endTurn();
        return;
      }
      if (action == "quit"){
        solitrio_self.endGame();
        solitrio_self.newRound();
        solitrio_self.endTurn();
        return;
      }
      if (action == "undo"){
        solitrio_self.undoMove();
        return;
      }

    });
  }


  returnCardImageHTML(name) {
    if (name[0] == 'E') { return ""; }
    else { return '<img src="/solitrio/img/cards/'+name+'.png" />'; }
  }



  returnDeck() {
    let suits = ["S","C","H","D","E"];
    var deck = {};
    /* WTF is with this indexing system??? */
    //2-10 of each suit, with indexing gaps on the 1's
    for (let i = 0; i<4; i++)
      for (let j=2; j<=10; j++){
        let index = 10*i+j;
        //deck[index.toString()] = suits[i]+j;
        let name = suits[i]+j;
        deck[name] = name;
      }
    //E[mpty] slots (1-4) into '41'-'44'
    for (let j = 1; j<=4; j++){
      let index = 40+j;
      //deck[index.toString()] = suits[4]+j;
      let name = suits[4]+j
      deck[name] = name;
    }
    
    return deck;
   }



  


  /*
  Combo function to check if in winning board state
  and shuffle cards that are not in winning positions
  */
  scanBoard(recycle = true) {
    let rows = new Array(4);
    rows.fill(0);

    let myarray = [];
    /*
      For each row of cards, if a 2 is in the left most position, 
      find the length of the sequential streak of same suit
    */
    for (let i = 0; i < 4; i++) {
      let rowsuite = "none";

      for (let j = 1; j < 10; j++) { //Don't read last slot in each row

        let slot  = "row"+(i+1)+"_slot"+j;
        let suite = this.returnCardSuite(slot);
        let num   = this.returnCardNumber(slot);

        if (j == 1 && num == 2) {
          rowsuite = suite;
        } 

        if (rowsuite === suite && num == j+1) {
            rows[i] = j;
            if (recycle)
              this.toggleCard(slot);
        }
        else break;
      }
    }
  
    //
    // pull off board
    //
    for (let i = 0; i<4; i++){
      for (let j = rows[i]+1; j < 11; j++){
        let divname = `row${i+1}_slot${j}`;
        if (recycle) this.hideCard(divname);
        myarray.push(this.game.board[divname]);  
      }
    }
    /*console.log(JSON.parse(JSON.stringify(rows)));
    console.log(JSON.parse(JSON.stringify(myarray)));*/

    let winningGame = (myarray.length === 4);

    if (recycle){
      //shuffle array, best method?
       myarray.sort(() => Math.random() - 0.5);

      //refill board

      for (let i = 0; i < 4; i++){
        for (let j = rows[i]+ 1; j<11; j++){
          let divname = `row${i+1}_slot${j}`;
          this.game.board[divname] = myarray.shift();
        }
      }

      this.boardToHand();
      this.displayBoard(100);
      this.endTurn();
     }
    return winningGame;
  }

  returnCardSuite(slot) {
    let card = this.game.board[slot];
    return card[0];
  }

  cardSuitHTML(suit){
    switch (suit){
      case "D": return "&diams;"
      case "H": return "&hearts;"
      case "S": return "&spades;"
      case "C": return "&clubs;"
      default: return "";
    }
  }

  returnCardNumber(slot) {
    let card = this.game.board[slot];
    if (card[0]==="E") //empty slot
      return 11;
    return card.substring(1);
  }

  quitGame(game_id = null, reason = "forfeit") {
    console.log("Mark game as closed");
    this.loadGame(game_id);
    this.game.over = 2;
    this.saveGame(game_id);
    this.app.connection.emit("arcade-remove-game", game_id);
  }

  receiveGameoverRequest(blk, tx, conf, app) {
    console.log("The game never ends in Solitrio");
    return;
  }


}

module.exports = Solitrio;

