
const { forEach } = require("jszip");
const videoBoxTemplate = require("./video-box.template");
const { setTextRange } = require("typescript");
// import {applyVideoBackground, } from 'virtual-bg';



class VideoBox {

    stream_id = null;
    stream = null;
    placeholderRendered = false;
    stream_rendered = false;
    waitTimer;
    waitSeconds = 0;
    is_connected_creator = false;
    receiving_connection = false
    is_connected = false

    constructor(app, mod, call_type, central, room_code, peer, container_class) {
        this.app = app;
        this.mod = mod;
        this.call_type = call_type;
        this.central = central;
        this.room_code = room_code;
        this.stream_id = peer
        this.containerClass = container_class
        this.retry_attempt_no = 0


        app.connection.on('mute', (kind, public_key) => {

            if (public_key !== this.stream_id) return;
            if (kind === "video") {
                let name;
                if (public_key === "local") {
                    let public_key = app.wallet.returnPublicKey();
                    name = app.keychain.returnUsername(public_key)
                } else {
                    name = app.keychain.returnUsername(public_key);
                }

                if (name.length > 10) {
                    name = `${name.slice(0, 10)}...`
                }
                this.updateVideoMuteStatus(name);
            }
        })
        app.connection.on('unmute', (kind, public_key) => {
            if (public_key !== this.stream_id) return;
            if (kind === "video") {
                this.removeVideoMuteStatus();
            }
        })


    }




    attachEvents(app, mod) {
        const video_box = document.querySelector(`#stream${this.stream_id}`);
        if (video_box) {
            video_box.querySelector('#reconnect-button').onclick = () => {
                this._reconnectCreator(this.stream_id);
                video_box.querySelector('#reconnect-button button').innerHTML = `<span class="lds-dual-ring2"> </span>`
                setTimeout(() => {
                    video_box.querySelector('#reconnect-button').style.opacity = 1;
                }, 30000)
            }

        }
    }


    render(stream, placeholder_info = null) {
        if (!this.stream) {
            this.stream = stream;
        }

        this.stream = stream;
        if (stream !== null) {
            this.removeConnectionMessage();
            if (this.stream_id === 'local') {
                this.renderStream({ muted: true });
            } else {
                this.renderStream({ muted: false })
                console.log('rendering stream ', this.is_creator);
            }
        } else {
            this.renderPlaceholder(placeholder_info);
        }



    }


    renderStream({ muted }) {
        if (!document.querySelector(`#stream${this.stream_id}`)) {
            this.app.browser.addElementToClass(videoBoxTemplate(this.stream_id, muted), this.containerClass);

        }

        const videoBox = document.querySelector(`#stream${this.stream_id}`);
        if (this.call_type === "audio") {
            videoBox.insertAdjacentHTML('beforeend', `<div class="audio-stream"> <i class="fas fa-microphone"></i></div> `);
        } else if (this.call_type === "video") {
            videoBox.firstElementChild.srcObject = this.stream;
        }
    }

    renderPlaceholder(placeholder_info = "negotiating peer connection") {
        if (!document.querySelector(`#stream${this.stream_id}`)) {
            this.app.browser.addElementToClass(videoBoxTemplate(this.stream_id, false), this.containerClass);
        }
        this.updateConnectionMessage(placeholder_info);
    }

    updateConnectionMessage(message) {
        const video_box = document.querySelector(`#stream${this.stream_id}`);
        if (video_box.querySelector('#connection-message')) {
            video_box.querySelector('#connection-message').innerHTML = `<p>${message}</p> <span class="lds-dual-ring"> </span> `
        } else {
            video_box.insertAdjacentHTML('beforeend', `<div id="connection-message"> <p> ${message} </p> <span class="lds-dual-ring"> </span></div> `);
        }
    }

    removeConnectionMessage() {
        const video_box = document.querySelector(`#stream${this.stream_id}`);

        if (video_box && video_box.querySelector('#connection-message')) {
            video_box.querySelectorAll('#connection-message').forEach(item => {
                item.parentElement.removeChild(video_box.querySelector('#connection-message'));
            })
        }
    }

    updateVideoMuteStatus(message) {
        const video_box = document.querySelector(`#stream${this.stream_id}`);
        if (video_box.querySelector('#video-mute-message')) {
            video_box.querySelector('#video-mute-message').innerHTML = `<p>${message}</p>`
        } else {
            video_box.insertAdjacentHTML('beforeend', `<div id="video-mute-message"> <p> ${message} </p></div> `);
        }
    }

    removeVideoMuteStatus() {
        const video_box = document.querySelector(`#stream${this.stream_id}`);
        if (video_box.querySelector('#video-mute-message')) {
            video_box.querySelectorAll('#video-mute-message').forEach(item => {
                item.parentElement.removeChild(video_box.querySelector('#video-mute-message'));
            })
        }
    }



    // startWaitTimer(is_creator) {
    //     this.attachEvents(this.app, this.mod)
    //     this.is_creator = is_creator;

    //     if (!is_creator) {
    //         this.receiving_connection = true;
    //     }

    //     let peer = this.stream_id;
    //     this.stopWaitTimer();

    //     this.waitTimer = setInterval(() => {
    //         // console.log(this.waitSeconds, is_creator)
    //         console.log(this.waitSeconds)
    //         this.waitSeconds += 1;
    //         if (this.waitSeconds === 10) {
    //             this.handleConnectionStateChange(peer, 'ten_seconds')
    //         }
    //         if (this.waitSeconds === 20) {
    //             this.handleConnectionStateChange(peer, 'twenty_seconds')
    //         }
    //         if (this.waitSeconds === 50) {
    //             this.stopWaitTimer();
    //             if (is_creator) {
    //                 this.updateReconnectionButton(true)
    //             } else {
    //                 this._reconnectRecipient(peer)
    //             }
    //         }
    //     }, 1000)
    // }

    // checkConnectionStatus() {
    //     let count = 0;
    //     const interval = setInterval(() => {
    //         count++;
    //         if (this.is_connected) {
    //             this.updateReconnectionButton(false);
    //             clearInterval(interval);
    //         } else if (count >= 60 && this.is_creator) {
    //             this.updateReconnectionButton(true);
    //             clearInterval(interval);
    //         }
    //     }, 1000);
    // }


    stopWaitTimer() {
        if (this.waitTimer) {
            clearInterval(this.waitTimer);
            this.waitSeconds = 0;
        }
    }




    remove() {
        if (document.querySelector(`#stream${this.stream_id}`)) {
            document.querySelector(`#stream${this.stream_id}`).parentElement.removeChild(document.querySelector(`#stream${this.stream_id}`))
        }

    }

    streamExists() {
        return this.stream;
    }




}









module.exports = VideoBox;
