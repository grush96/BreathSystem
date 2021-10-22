const { createServer } = require("http");
const { Server } = require("socket.io");
const { instrument } = require("@socket.io/admin-ui");
const express = require("express");
const path = require('path');
const { formatMessage, formatTurn } = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require('./utils/users');
const { characterCreate, characterLeave, getRoomCharacters, removeRoomCharacters } = require('./utils/character');

const app = express();

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ["https://admin.socket.io"],
    credentials: true
  }
});

// Run when client connects
io.on('connection', socket => {
	socket.on('joinRoom', ({username, room}) => {
		const user = userJoin(socket.id, username, room);

		socket.join(user.room);

		// // Welcome current user
		// socket.emit('message', formatMessage(botName, 'Welcome to ChatCord!'));

		// Broadcast when a user connects
		// socket.broadcast.to(user.room).emit('message', 
		// 	formatMessage(botName, `${user.username} has joined the chat`));

		// Send users and room info
		io.to(user.room).emit('roomUsers', {
			room: user.room,
			users: getRoomUsers(user.room)
		});

		// Send character in combat info
		io.to(user.room).emit('characterJoin', getRoomCharacters(user.room));
	});

	// Listen for chatMessage
	socket.on('chatMessage', msg => {
		console.log("chat message received");
		const user = getCurrentUser(socket.id);

		io.to(user.room).emit('message', formatMessage(user.username, msg));
	});

	// Listen for add character
	socket.on('addChar', ({ character, turn, additional}) => {
		console.log(character);
		console.log(turn);
		console.log(additional);
		const user = getCurrentUser(socket.id);
		characterCreate( character, user, turn, additional);
		io.to(user.room).emit('characterJoin', getRoomCharacters(user.room));
	});

	// Listen for remove character
	socket.on('removeChar', ({ room, id, name }) => {
		characterLeave(room, id, name);
		io.to(room).emit('characterJoin', getRoomCharacters(room));
	});

	socket.on('getParty', room => {
		io.to(room).emit('fullParty', getRoomCharacters(room));
	});

	socket.on('addTurn', ({ turnID, pcAction }) => {
		const user = getCurrentUser(socket.id);
		io.to(user.room).emit('newTurn', formatTurn(turnID, pcAction));
	});

	socket.on('beginCombat', () => {
		const user = getCurrentUser(socket.id);
		io.to(user.room).emit("combatBegins");
	});

	socket.on('nextSecond', () => {
		const user = getCurrentUser(socket.id);
		io.to(user.room).emit("nextSecond");
	});

	socket.on('endCombat', () => {
		const user = getCurrentUser(socket.id);
		io.to(user.room).emit("combatEnds");
	})

	//Runs when client disconnects
	socket.on('disconnect', () => {
		const user = userLeave(socket.id);

		if (user) {
			// io.to(user.room).emit('message', 
			// formatMessage(botName, `${user.username} has left the chat`));

			// Send users and room info
			io.to(user.room).emit('roomUsers', {
				room: user.room,
				users: getRoomUsers(user.room)
			});
		}

		// TODO: if all players move to combat characters will be removed
		//       solutions - pause before executing or all on one page
		// if (getRoomUsers(user.room).length === 0) {
		//     removeRoomCharacters(user.room);
		// }
	});
});

instrument(io, { auth: false });

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
	console.log(`Server listening at port: ${PORT}`);
});