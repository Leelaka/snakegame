const express = require('express');
let app = new express();
const port = 3000 || process.env.port;
const http = require('http');
const server = http.createServer(app);
const socketio = require('socket.io');
const io = socketio(server);
const {gameLoop, getUpdatedVelocity, initGame} = require('./game');
const {FRAME_RATE} = require('./constants');
const { makeid } = require('./utils');
app.use(express.static(__dirname + '/public'));


const state = {};
const clientRooms = {};

io.on('connection', client => {
    // client.emit('init', {data: 'Hello World'});
    //state = createGameState();

    client.on('keydown', handleKeydown);
    client.on('newGame', handleNewGame);    
    client.on('joinGame', handleJoinGame); 

    function handleJoinGame(gameCode){
        const room = io.sockets.adapter.rooms[gameCode];

        let allUsers;
        if(room){
            allUsers = room.sockets;
        }
        let numClients = 0;
        if(allUsers){
            numClients = Object.keys(allUsers).length;
        }

        if(numClients === 0) {
            client.emit('unknownGame');
            return;
        }
        else if(numClients > 1) {
            client.emit('tooManyPlayers');
            return;
        }
        clientRooms[client.id] = gameCode;
        client.join(gameCode);
        client.number = 2;
        client.emit('init', 2);

        startGameInterval(gameCode);
    }

    function handleNewGame(){
        let roomName = makeid(5);
        clientRooms[client.id] = roomName;
        client.emit('gameCode', roomName);

        state[roomName] = initGame();

        client.join(roomName);
        client.number = 1;
        client.emit('init', 1);

    }
    function handleKeydown(keyCode){
        const roomName = clientRooms[client.id];

        if(!roomName){
            return;
        }
        try {
            keyCode = parseInt(keyCode);
        } catch(e) {
            console.error(e);
            return;
        }

        const vel = getUpdatedVelocity(keyCode);
        
        if(vel){
            state[roomName].players[client.number - 1].vel = vel;
        }
    }
  
});

function startGameInterval(roomName) {
    const intervalId = setInterval(() => {
        const winner = gameLoop(state[roomName]);

        if(!winner){
            emitGameState(roomName, state[roomName]);
            // client.emit('gameState', JSON.stringify(state));

        } else {
            emitGameOver(roomName, winner);
            state[roomName] = null;
            // client.emit('gameOver');
            clearInterval(intervalId);
        }
    }, 1000 / FRAME_RATE);
}

function emitGameState(roomName, state){
    io.sockets.in(roomName).emit('gameState', JSON.stringify(state));
}

function emitGameOver(roomName, winner){
    io.sockets.in(roomName).emit('gameOver', JSON.stringify({winner}));
}

server.listen(port, ()=>{
    console.log('Server is running on ', port);
}); 

// io.listen(process.env.PORT || 3000);