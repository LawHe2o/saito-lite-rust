module.exports = LeagueOverlayTemplate = (app, mod, league) => {

    console.log(league.game);
    let game_mod = app.modules.returnModuleByName(league.game);

    let html = `
    <div class="league-overlay-container">
        <div class="league-overlay">
            <div class="league-overlay-header">
                <div class="league-overlay-header-image" style="background-image: url('${game_mod?.returnArcadeImg()}')">
                </div>
                <div class="league-overlay-header-title-box">
                    <div class="league-overlay-header-title-box-title">${league.name}</div>
                    <div class="league-overlay-header-title-box-desc">${(league.admin) ? `${league.status} league` : game_mod.returnGameType() }</div>
                </div>
            </div>
            <div class="league-overlay-body">
                <div class="league-overlay-body-content">
                  <div class="league-overlay-description">${league.description}</div>
                  <div class="league-overlay-league-body-games">
                      <div class="league-overlay-games-list league_recent_games"></div>
                  </div>
              </div>
                <div class="league-overlay-leaderboard"></div>
            </div>
            <div class="league-overlay-controls">
              <button class="league-overlay-create-game-button saito-button saito-button-primary">create game</button>
            </div>
        </div>
    </div>
 
    `;

    return html;
};



