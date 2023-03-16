const MixinDepositTemplate = require("./mixin-deposit.template");
const SaitoOverlay = require("./../../../../lib/saito/ui/saito-overlay/saito-overlay");

class MixinDeposit {

  constructor(app, mod, container = "") {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    this.address = null;
    this.confs = null;
    this.ticker = null;

    this.app.connection.on("mixin-deposit-overlay-render-request", (obj) => {
      
      this.address = obj.address;
      this.confs = obj.confs;
      this.ticker = obj.ticker;      
      this.render();
    });
  }

  render() {
    this.overlay.show(MixinDepositTemplate(this.app, this.mod, this));
    this.attachEvents();
  }  

  attachEvents() {    
    document.querySelector("#copy-deposit-add").onclick = (e) => {
      let public_key = document.querySelector(".public-address").value;
      
      navigator.clipboard.writeText(public_key);
      document.querySelector("#copy-deposit-add").classList.add("copy-check");

      setTimeout(() => {
        document.querySelector("#copy-deposit-add").classList.remove("copy-check");            
      }, 400);
    };

    // const QRCode = require('../../../../lib/helpers/qrcode');
    // return new QRCode(
    //   document.getElementById("deposit-qrcode"),
    //   this.address
    // );
  }

}

module.exports = MixinDeposit;

