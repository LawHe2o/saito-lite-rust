const SaitoGroupTemplate = require('./../../../../lib/saito/new-ui/templates/saito-group.template');
const SaitoUserTemplate = require('./../../../../lib/saito/new-ui/templates/saito-user.template');

module.exports = (app, mod) => {

  let groups = app.keys.groups;
  let keys = app.keys.keys;


  let html = `

    <div class="redsquare-appspace-contacts">

      <div class="saito-page-header">
        <div id="redsquare-add-contact" class="redsquare-add-contact saito-button-secondary small" style="float: right;">Add Contact</div>
        <div class="saito-page-header-title">CONTACTS</div>
        <div class="saito-page-header-text">Use this page to manage the contacts saved in your wallet, or create groups for secure communication channels with many participants. Remember to backup your wallet after creating a new group or adding a new contact.</div>
      </div>
  `;
 
  if (groups) {
    if (groups.length > 0) {
      html += `
        <h6>Your Groups</h6>
        <div id="saito-grouplist" class="saito-grouplist" style="margin-bottom:2rem">
      `;
      for (let i = 0; i < groups.length; i++) {
        html += SaitoGroupTemplate(app, mod, groups[i]);
      }
      html += `
        </div>
      `;
    }
  }


  if (keys) {
    if (keys.length > 0) {

      html += `
        <h6>Contacts</h6>
        <div id="saito-friendlist" class="saito-friendlist">
      `;

      for (let i = 0; i < keys.length; i++) {
        html += SaitoUserTemplate(app, mod, keys[i].publickey, keys[i].identifiers);
      }

      html += `
        </div>
      `;

    }
  }

  html += `
    </div>
  `;

  return html;

}

