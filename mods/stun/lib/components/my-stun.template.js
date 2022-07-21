module.exports = (app, mod, listeners) => {
  //
  // METHOD NOT USED ANYWHERE???
  //
  const canConnectTo = () => {
    let html = "";
    for (let i = 0; i < listeners.length; i++) {
      html += `<option  data-id="${listeners[i]}"> ${listeners[i]}</option>`;
    }

    return html;
  }

  return `<card class="appear my-stun-container">

                <h2> Stun Video </h2>
                <p>  Use Saito to start a peer-to-peer video chat!</p>
                <div class="my-stun-container-actions">
                <div class="my-stun-container-create">
                <p> Create </p>
                <button id="createInvite" class="saito-button-secondary"> Create Invite:</button>
                </div>
                <div class="my-stun-container-join">
                   <p> Join an invite:</p>
                  <div>
                  <input placeholder="Insert Room Code" id="inviteCode" />
                  <button id="joinInvite" class="saito-button-secondary">Join</button>
                  </div>
            
                </div>
                </div>
         
    
          </card>`;
}
