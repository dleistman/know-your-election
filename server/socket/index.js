// SERVER SOCKET

const store = require('../store');
const {
  countdownServer,
  gameStartServer,
  gameEndServer
} = require('../store/game');
const { updateMapServer, clearMapServer } = require('../store/mapStatus');

const { dispatch, getState } = store;

module.exports = io => {
  io.on('connection', socket => {
    console.log(
      `A socket connection to the server has been made: ${socket.id}`
    );

    socket.on('players-inc', () => {
      const clientsConnected = Object.keys(io.engine.clients).length;
      io.emit('update-players', clientsConnected);
    });

    socket.on('fetch-game', () => {
      const serverGame = getState().game;
      const serverMap = getState().mapStatus;
      const {
        gameYear,
        gameType,
        secondsRemaining,
        isCurrentGame
      } = serverGame;
      socket.emit('send-game', {
        gameYear,
        gameType,
        secondsRemaining,
        isCurrentGame,
        serverMap
      });
    });

    socket.on('start-new-game', ({ gameType, gameYear, secondsRemaining }) => {
      // clear any map state from previous games
      dispatch(clearMapServer());

      // create a new game on the server store
      // for new players to grab game state

      // create a game timer
      const gameClock = createServerGameClock();

      // create a fresh game with timer, type, and year on local state
      dispatch(
        gameStartServer(gameClock, gameType, gameYear, secondsRemaining)
      );

      // emit event to cause clients to pull down new game
      socket.broadcast.emit('new-game');
    });

    socket.on('toggle-state', ({ stateId, party }) => {
      // update state of map on server for anyone joining later
      dispatch(updateMapServer(stateId, party));

      // broadcast change to clients
      socket.broadcast.emit('toggle-state', { stateId, party });
    });

    socket.on('end-game', () => {
      // tell clients to all end their games
      socket.broadcast.emit('end-game');

      // clear the game state
      dispatch(gameEndServer());
    });

    socket.on('disconnect', () => {
      console.log(`Connection ${socket.id} has left the building`);
      const clientsConnected = Object.keys(io.engine.clients).length;
      io.emit('update-players', clientsConnected);
    });

    // ----HELPER FUNCTIONS -----------------------------------------------
    const createServerGameClock = () => {
      const gameClock = setInterval(() => {
        const sec = getState().game.secondsRemaining;
        if (sec >= 0) {
          dispatch(countdownServer());
        } else {
          clearInterval(gameClock);
        }
      }, 1000);

      return gameClock;
    };
  });
};
