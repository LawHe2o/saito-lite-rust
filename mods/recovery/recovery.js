const saito = require("../../lib/saito/saito");
const ModTemplate = require("../../lib/templates/modtemplate");
const SaitoLogin = require("./../../lib/saito/ui/modals/login/login");
const SaitoBackup = require("./../../lib/saito/ui/modals/backup/backup");
const Transaction = require("../../lib/saito/transaction");

class Recovery extends ModTemplate {
  constructor(app) {
    super(app);
    this.name = "Recovery";
    this.description = "Secure wallet backup and recovery";
    this.categories = "Utilities Core";

    this.backup_overlay = new SaitoBackup(app, this);
    this.recover_overlay = new SaitoLogin(app, this);

    this.keychain_hash = "";

    app.connection.on("wallet-updated", async () => {
      let new_keychain_hash = app.crypto.hash(
        JSON.stringify(app.keychain.keys) + JSON.stringify(app.keychain.groups)
      );
      if (new_keychain_hash != this.keychain_hash) {
        this.keychain_hash = new_keychain_hash;
        console.log("our wallet has updated, so rebroadcasting wallet recovery TX");
        let key = app.keychain.returnKey(await app.wallet.getPublicKey());
        if (key) {
          if (key.wallet_decryption_secret && key.wallet_retrieval_hash) {
            let newtx = await this.createBackupTransaction(
              key.wallet_decryption_secret,
              key.wallet_retrieval_hash
            );
            await this.app.network.propagateTransaction(newtx);
          }
        }

        return;
      }
    });

    app.connection.on("recovery-backup-overlay-render-request", async (obj) => {
      //
      // update callbacks
      //
      if (obj.success_callback != null) {
        this.backup_overlay.success_callback = obj.success_callback;
      }
      if (obj.failure_callback != null) {
        this.backup_overlay.failure_callback = obj.failure_callback;
      }

      //
      // if submitted with email / pass, auto-backup
      //
      if (obj.email && obj.pass) {
        let decryption_secret = this.returnDecryptionSecret(obj.email, obj.pass);
        let retrieval_hash = this.returnRetrievalHash(obj.email, obj.pass);

        //
        // save email
        //
        this.app.keychain.addKey(await this.app.wallet.getPublicKey(), {
          email: obj.email,
          wallet_decryption_secret: decryption_secret,
          wallet_retrieval_hash: retrieval_hash,
        });

        //
        // and send transaction
        //
        let newtx = this.createBackupTransaction(decryption_secret, retrieval_hash);
        await this.app.network.propagateTransaction(newtx);

        if (this.backup_overlay.success_callback) {
          this.backup_overlay.success_callback(true);
        }
        return;
      }

      this.backup_overlay.render();
    });

    app.connection.on("recovery-recover-overlay-render-request", async (obj) => {
      //
      // update callbacks
      //
      if (obj.success_callback != null) {
        this.backup_overlay.callback = obj.success_callback;
      }

      //
      // if submitted with email / pass, auto-backup
      //
      if (obj.email && obj.pass) {
        let decryption_secret = this.returnDecryptionSecret(obj.email, obj.pass);
        let retrieval_hash = this.returnRetrievalHash(obj.email, obj.pass);

        let newtx = this.createRecoverTransaction(retrieval_hash);
        let peers = this.app.network.returnPeersWithService("recovery");

        if (peers.length > 0) {
          await this.app.network.sendTransactionWithCallback(
            newtx,
            async (res) => {
              if (!res) {
                console.log("empty response!");
                return;
              }
              if (!res.rows) {
                console.log("no rows returned!");
                if (this.recover_overlay.failure_callback) {
                  this.recover_overlay.failure_callback(true);
                }
                return;
              }
              if (!res.rows[0].tx) {
                console.log("no transaction in row returned");
                if (this.recover_overlay.failure_callback) {
                  this.recover_overlay.failure_callback(true);
                }
                return;
              }

              let tx = JSON.parse(res.rows[0].tx);
              let identifier = res.rows[0].identifier;
              let newtx2 = new Transaction(tx);
              let txmsg = newtx2.returnMessage();

              let encrypted_wallet = txmsg.wallet;
              let decrypted_wallet = this.app.crypto.aesDecrypt(
                encrypted_wallet,
                decryption_secret
              );
              this.app.wallet.wallet = JSON.parse(decrypted_wallet);
              this.app.wallet.saveWallet();
              this.app.keychain.addKey(await this.app.wallet.getPublicKey(), {
                identifier: identifier,
              });
              this.app.keychain.saveKeys();
              this.recover_overlay.remove();

              try {
                window.location.reload();
                return;
              } catch (err) {}

              if (this.recover_overlay.success_callback) {
                this.recover_overlay.success_callback(true);
              }
            },
            peers[0]
          );
        } else {
          if (document.querySelector(".saito-overlay-form-text")) {
            document.querySelector(".saito-overlay-form-text").innerHTML =
              "<center>Unable to download encrypted wallet from network...</center>";
          }
          if (this.recover_overlay.failure_callback) {
            this.recover_overlay.failure_callback(true);
          }
        }

        return;
      }

      await this.recover_overlay.render();
    });
  }

  returnDecryptionSecret(email = "", pass = "") {
    let hash1 = "WHENINDISGRACEWITHFORTUNEANDMENSEYESIALLALONEBEWEEPMYOUTCASTSTATE";
    let hash2 = "ANDTROUBLEDEAFHEAVENWITHMYBOOTLESSCRIESANDLOOKUPONMYSELFANDCURSEMYFATE";
    return this.app.crypto.hash(this.app.crypto.hash(email + pass) + hash1);
  }

  returnRetrievalHash(email = "", pass = "") {
    let hash1 = "WHENINDISGRACEWITHFORTUNEANDMENSEYESIALLALONEBEWEEPMYOUTCASTSTATE";
    let hash2 = "ANDTROUBLEDEAFHEAVENWITHMYBOOTLESSCRIESANDLOOKUPONMYSELFANDCURSEMYFATE";
    return this.app.crypto.hash(this.app.crypto.hash(hash2 + email) + pass);
  }

  returnServices() {
    let services = [];
    if (this.app.BROWSER == 0) {
      services.push({ service: "recovery" });
    }
    return services;
  }

  async respondTo(type) {
    if (type == "saito-header") {
      let x = [];
      let key = this.app.keychain.returnKey(await this.app.wallet.getPublicKey());
      let has_registered_username = false;
      if (key) {
        if (key.registered_username) {
          has_registered_username = true;
        }
      }
      if (this.app.browser.isMobileBrowser()) {
        if (has_registered_username) {
          x.push({
            text: "Login",
            icon: "fa fa-sign-in",
            allowed_mods: ["redsquare"],
            callback: function (app) {
              let success_callback = function (res) {};
              let failure_callback = function (res) {};
              app.connection.emit(
                "recovery-recover-overlay-render-request",
                (success_callback, failure_callback)
              );
            },
          });
        } else {
          x.push({
            text: "Backup",
            icon: "fa-sharp fa-solid fa-cloud-arrow-up",
            rank: 130,
            callback: function (app) {
              let success_callback = function (res) {};
              let failure_callback = function (res) {};
              app.connection.emit(
                "recovery-backup-overlay-render-request",
                (success_callback, failure_callback)
              );
            },
          });
        }
      } else {
        if (has_registered_username) {
          x.push({
            text: "Backup",
            icon: "fa-sharp fa-solid fa-cloud-arrow-up",
            rank: 130,
            callback: function (app) {
              let success_callback = function (res) {};
              let failure_callback = function (res) {};
              app.connection.emit(
                "recovery-backup-overlay-render-request",
                (success_callback, failure_callback)
              );
            },
          });
        }
      }
      return x;
    }
    return null;
  }

  onConfirmation(blk, tx, conf, app) {
    if (conf == 0) {
      let txmsg = tx.returnMessage();
      if (txmsg.request == "recovery backup") {
        this.receiveBackupTransaction(tx);
      }
    }
  }

  async handlePeerTransaction(app, tx = null, peer, mycallback) {
    try {
      if (tx == null) {
        return;
      }

      let txmsg = tx.returnMessage();

      if (txmsg.request == "recovery backup") {
        this.receiveBackupTransaction(tx);
      }

      if (txmsg.request === "recovery recover") {
        this.receiveRecoverTransaction(tx, mycallback);
        return;
      }
    } catch (err) {
      console.log("Error in handlePeerTransaction in Recovery module: " + err);
    }
  }

  ////////////
  // Backup //
  ////////////
  async createBackupTransaction(decryption_secret, retrieval_hash) {
    let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee();
    newtx.msg = {
      module: "Recovery",
      request: "recovery backup",
      email: "",
      hash: retrieval_hash,
      wallet: this.app.crypto.aesEncrypt(JSON.stringify(this.app.wallet.wallet), decryption_secret),
    };
    return this.app.wallet.signTransaction(newtx);
  }

  async receiveBackupTransaction(tx) {
    let txmsg = tx.returnMessage();
    let publickey = tx.transaction.from[0].add;
    let hash = txmsg.hash || "";
    let txjson = JSON.stringify(tx.transaction);

    let sql =
      "INSERT OR REPLACE INTO recovery (publickey, hash, tx) VALUES ($publickey, $hash, $tx)";
    let params = {
      $publickey: publickey,
      $hash: hash,
      $tx: txjson,
    };
    await this.app.storage.executeDatabase(sql, params, "recovery");
  }

  /////////////
  // Recover //
  /////////////
  createRecoverTransaction(retrieval_hash) {
    let newtx = this.app.wallet.createUnsignedTransactionWithDefaultFee();
    newtx.msg = {
      module: "Recovery",
      request: "recovery recover",
      hash: retrieval_hash,
    };
    return this.app.wallet.signTransaction(newtx);
  }

  //
  // this is never run, see overlay
  //
  async receiveRecoverTransaction(tx, mycallback = null) {
    if (mycallback == null) {
      return;
    }
    if (this.app.BROWSER == 1) {
      return;
    }

    let txmsg = tx.returnMessage();
    let publickey = tx.transaction.from[0].add;
    let hash = txmsg.hash || "";

    let sql = "SELECT * FROM recovery WHERE hash = $hash";
    let params = {
      $hash: hash,
    };
    let res = {};
    res.rows = await this.app.storage.queryDatabase(sql, params, "recovery");
    mycallback(res);
  }
}

module.exports = Recovery;
