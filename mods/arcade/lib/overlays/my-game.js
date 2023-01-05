const SaitoOverlay = require('./../../../../lib/saito/ui/saito-overlay/saito-overlay');
const MyGameOverlayTemplate = require('./my-game.template');

class MyGameOverlay {

  constructor(app, mod, tx=null) {
    this.app = app;
    this.mod = mod;
    this.invite_tx = tx;
    this.overlay = new SaitoOverlay(app, mod, false, true);
  }

  render() {
    
    let txmsg = this.invite_tx.returnMessage();
    let game_mod = this.app.modules.returnModuleByName(txmsg.name);

    this.overlay.show(MyGameOverlayTemplate(this.app, this.mod, this.invite_tx));
    this.overlay.setBackground(`/${game_mod.returnSlug()}/img/arcade/arcade.jpg`);
    this.attachEvents();
  }
  
  attachEvents() {

    document.querySelector(".arcade-game-controls-join-game").onclick = (e) => {
    }
  }

}


module.exports = MyGameOverlay;

