const BackupTemplate = require('./backup.template');
const SaitoOverlay = require('./../../saito-overlay/saito-overlay');
const SaitoLoader = require('./../../saito-loader/saito-loader');

class Backup {

  constructor(app, mod, success_callback = () => {}, failure_callback = () => {}) {
    this.app = app;
    this.mod = mod;
    this.success_callback = success_callback;
    this.failure_callback = failure_callback;
    this.modal_overlay = new SaitoOverlay(this.app, this.mod);
    this.loader = new SaitoLoader(this.app, this.mod, ".saito-overlay-form");

  }

  render(identifier=null, newIdentifier = false) {
    if (!identifier) { return; }
    this.modal_overlay.show(BackupTemplate(identifier, newIdentifier));
    this.attachEvents();
  }

  show() { this.render(); }
  hide() { this.remove(); }

  remove() {
    this.modal_overlay.remove();
  }

  attachEvents() {
    let component_self = this;

    document.querySelector('.saito-overlay-form-submit').onclick = (e) => {
      e.preventDefault();
      let email = document.querySelector(".saito-overlay-form-email").value;
      let password = document.querySelector(".saito-overlay-form-password").value;

      document.querySelector(".saito-overlay-form-header").remove();
      document.querySelector(".saito-overlay-form-text").remove();
      document.querySelector(".saito-overlay-subform").remove();
      document.querySelector(".saito-overlay-form-submit").remove();

      component_self.modal_overlay.hide();
      let recovery_mod = component_self.app.modules.returnModule("Recovery");
      if (recovery_mod) {

        let obj = { pass : password , email : email };
        // this triggers backup
        component_self.app.connection.emit("recovery-backup-overlay-render-request", (obj));
        component_self.success_callback(email, password);

      } else {
      	alert("Wallet Recovery Module not installed - please backup manually");
      }

    }
  }

}

module.exports = Backup;

