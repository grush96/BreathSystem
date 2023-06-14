const { createServer } = require("http");
const { Server } = require("socket.io");
const { instrument } = require("@socket.io/admin-ui");
const express = require("express");
const cors = require("cors");
const path = require('path');
const { MongoClient } = require("mongodb");
const e = require("cors");

const uri = "mongodb+srv://grush:mD5gvXU9@cluster0.icein.mongodb.net/BreathDB?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

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

app.use(cors());

var collection;

// Run when client connects
io.on('connection', socket => {
	const socketId = socket.id;
	let roomCode;
	let user;

	socket.on('checkRoom', async (room) => {
		try {
			console.log("yep");
			let result = await collection.findOne({ "_id": room});
			console.log(result);
			if (!result) {
				console.log("false");
				socket.emit("checkRoomResponse", false);
			} else {
				console.log("true");
				socket.emit("checkRoomResponse", true);
			}
		} catch(e) {
			console.error(e);
		}
	});

	socket.on('joinRoom', async ({username, room}) => {
		try {
			let result = await collection.findOne({ "_id": room });
			roomCode = room;
			user = username;
			if (!result) {
				await collection.insertOne({ 
					"_id": room,
					userCount: 0,
				 	users: [],
					messages: [],
					characters: [],
					colors: ["is-dark", "is-red", "is-blue", "is-green", "is-pink", "is-orange", "is-purple", "is-brown", "is-yellow", "is-light-blue", "is-light-green"]
				});
			}

			collection = client.db("datadb").collection("rooms");
			const cursor = collection.find({ "_id": room });
			const results = await cursor.toArray();
			let userColor;

			if (results.length > 0) {
				userColor = results[0].colors[0];
			}

			collection.updateOne(
				{ "_id": room }, 
				{ "$pop": { "colors": -1}}
			);
			
			collection.updateOne(
				{ "_id": room },
				{ "$push": { "users": {id: socket.id, name: username, color: userColor} } } // add colors?
			);

			collection.updateOne(
				{ "_id": room },
				{ "$inc": { userCount: 1 } }
			);

			socket.join(room);
			socket.activeRoom = room;
			
			const users = await getRoomUsers(room);
			io.to(room).emit('roomUsers', users);
			
			const messages = await getRoomMessages(room);
			socket.emit("joinedChat", messages);

			// Send character in combat info
			const characters = await getRoomChars(room);
			io.to(room).emit('characterJoin', characters);
		} catch (e) {
			console.error(e);
		}
	});

	// Listen for chatMessage
	socket.on('chatMessage', async (username, msg) => {
		try {
			console.log("username: " + username);
			const user = await getRoomUser(socket.activeRoom, socket.id);
			const color = user.color;
			collection.updateOne(
				{ "_id": socket.activeRoom }, 
				{ "$push": { "messages": {
					name: username, 
					text: msg, 
					color: color
				}}}
			);

			io.to(socket.activeRoom).emit("message", {username, msg, color});
		} catch (e) {
			console.error(e);
		}
	});

	// Listen for add character
	socket.on('addChar', async (username, character, turn, additional) => {
		try {
			removeRoomChar(socket.activeRoom, socket.id, character.name);
			console.log(character);
			console.log(turn);
			console.log(additional);
			const user = await getRoomUser(socket.activeRoom, socket.id);
			// TODO: add color to user section and in main, add class based on color
			collection.updateOne(
				{ "_id": socket.activeRoom }, 
				{ "$push": { "characters": {
					$each: [{
						user: {
							id: socket.id,
							name: username,
							room: socket.activeRoom,
							color: user.color,
							ready: false
						},
						character: character,
						turn: turn,
						additional: additional
					}],
					$sort: { "character.name": 1}
				}}}
			);
			
			const characters = await getRoomChars(socket.activeRoom);
			console.log("server characters: " + characters);
			io.to(socket.activeRoom).emit('characterJoin', characters);
		} catch (e) {
			console.error(e);
		}
	});

	// Listen for get character info
	// TODO: use blueprint of functions below
	socket.on('getChar', async ({room, id, name}) => {
		try {
			collection = client.db("datadb").collection("rooms");
			const cursor = collection.find({ "_id": room });
			const results = await cursor.toArray();
			let character;

			if (results.length > 0) {
				character = results[0].characters.filter(character => {
					return character.character.name === name;
				});
			}
			console.log(character[0]);
			socket.emit('getCharResponse', character[0]);
		} catch (e) {
			console.error(e);
		}
	});

	// Listen for remove character
	socket.on('removeChar', async ({ room, id, name }) => {
		try {
			removeRoomChar(room, id, name);
			const characters = await getRoomChars(socket.activeRoom);
			io.to(socket.activeRoom).emit('characterJoin', characters);
		} catch (e) {
			console.error(e);
		}
	});

	socket.on("charReady", (username, charName, ready) => {
		collection.updateOne({ 
				"_id": socket.activeRoom, 
				"characters": { $elemMatch: { "user.name": username, "character.name": charName }} 
			}, 
			{ "$set": { "characters.$.user.ready": ready }}
		);

		io.to(socket.activeRoom).emit('charReadyResponse', {username, charName, ready});
	});

	socket.on('setRound', (roundNum) => {
		io.to(socket.activeRoom).emit('setRoundResponse', roundNum);
	});

	socket.on('getParty', async() => {
		try {
			const characters = await getRoomChars(socket.activeRoom);
			io.to(socket.activeRoom).emit('fullParty', characters);
		} catch (e) {
			console.error(e);
		}
	});

	socket.on('addTurn', ({ turnID, pcAction }) => {
		io.to(socket.activeRoom).emit('newTurn', {turnID, pcAction});
	});

	socket.on('beginCombat', async() => {
		const userChars = await getUserChars(socket.activeRoom, user);
		const allChars = await getRoomChars(socket.activeRoom);
		io.to(socket.activeRoom).emit("combatBegins", userChars, allChars);
	});

	socket.on('nextSecond', () => {
		io.to(socket.activeRoom).emit("nextSecond");
	});

	socket.on('endCombat', () => {
		io.to(socket.activeRoom).emit("combatEnds");
	})

	// socket.on('disconnecting', async() => {});
	
	//Runs when client disconnects
	socket.on('disconnect', async () => {
		try {
			collection.updateOne(
				{ "_id": roomCode }, 
				{ "$pull": { "users": { id: socketId } } }
			);

			collection.updateOne(
				{ "_id": roomCode }, 
				{ "$inc": { userCount: -1 } }
			);

			const user = await getRoomUser(roomCode, socketId);
			if (user) {
				const color = user.color;

				collection.updateOne(
					{ "_id": roomCode }, 
					{ "$push": { "colors": { $each: [color], $position: 0 } } }
				);
			}
			
			await delay(100);

			// Send users and room info
			const users = await getRoomUsers(roomCode);
			io.to(roomCode).emit('roomUsers', users);
			
			const cursor = collection.find({ "_id": roomCode });
			let usersLeft = 0;
			const results = await cursor.toArray();
			if (results.length > 0) {
				usersLeft = results[0].userCount;
				results[0].users.forEach((user) => {
					console.log(`username: ${user.name}`);
				});
			}

			console.log(`users left: ${usersLeft}`);

			if (usersLeft === 0) {
				console.log("no users");
				collection.deleteOne({ "_id": roomCode });
			}
		} catch (e) {
			console.error(e);
		}
	});
});

async function getRoomUsers(room) {
	try {
		await delay(50);

		collection = client.db("datadb").collection("rooms");
		const cursor = collection.find({ "_id": room });
		const results = await cursor.toArray();
		let users;

		if (results.length > 0) {
			users = results[0].users;
		}
		return users;
	} catch (e) {
		console.error(e);
	}
}

async function getRoomUser(room, userId) {
	try {
		console.log("room: " + room);
		console.log("userId: " + userId);
		collection = client.db("datadb").collection("rooms");
		const cursor = collection.find({ "_id": room});
		const results = await cursor.toArray();
		let user 

		if (results.length > 0) {
			user = results[0].users.filter(user => {
				return user.id === userId;
			});
			return user[0];
		}
	} catch (e) {
		console.error(e);
	}
}

async function getRoomMessages(room) {
	try {
		collection = client.db("datadb").collection("rooms");
		const cursor = collection.find({ "_id": room });
		const results = await cursor.toArray();
		let messages;

		if (results.length > 0) {
			messages = results[0].messages;
		}
		return messages;
	} catch (e) {
		console.error(e);
	}
}

async function getRoomChars(room) {
	try {
		await delay(50);

		collection = client.db("datadb").collection("rooms");
		const cursor = collection.find({ "_id": room });
		const results = await cursor.toArray();
		let characters;

		if (results.length > 0) {
			characters = results[0].characters;
		}
		return characters;
	} catch (e) {
		console.error(e);
	}
}

async function getRoomChar(room, name) {
	try {
		collection = client.db("datadb").collection("rooms");
		const cursor = collection.find({ "_id": room });
		const results = await cursor.toArray();
		let character;

		if (results.length > 0) {
			character = results[0].characters.filter(character => {
				return character.character.name === name;
			});
			return character[0];
		} else {
			return 0;
		}
	} catch (e) {
		console.error(e);
	}
}

async function getUserChars(room, username) {
	try {
		collection = client.db("datadb").collection("rooms");
		const cursor = collection.find({ "_id": room });
		const results = await cursor.toArray();
		let userChars;

		if (results.length > 0) {
			userChars = results[0].characters.filter(character => {
				return character.user.name === username;
			});
			return userChars;
		} else {
			return 0;
		}
	} catch (e) {
		console.error(e);
	}
}

async function removeRoomChar(room, id, name) {
	try {
		if (getRoomChar(room, name) !== 0) {
			collection.updateOne(
				{ "_id": room }, 
				{ "$pull": {
					"characters": { 
						"user.id": id , 
						"character.name": name
					}
				}},
				{ multi: true }
			);
		}
	} catch (e) {
		console.error(e);
	}
}

function delay(time) {
	return new Promise(resolve => setTimeout(resolve, time));
}

app.get("/rooms", async (request, response) => {
	try {
		// let result = await collection.findOne({ "_id": request.query.room }).project({ messages: 1, _id: 0 });
		let result = await collection.findOne({ "_id": request.query.room });
		response.send(result);
	} catch (e) {
		response.status(500).send({ message: e.message });
	}
});

app.get("/ids", async (request, response) => {
	try {
		let result = await collection.findOne({ "_id": request.query.room });
		if (result) {
			response.send(true);
		} else {
			response.send(false);
		}
	} catch (e) {
		response.status(500).send({ message: e.message });
	}
});

instrument(io, { auth: false });

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, async () => {
	try {
		await client.connect();
		collection = client.db("datadb").collection("rooms");
		console.log(`Server listening at port: ${PORT}`);
	} catch (e) {
		console.error(e);
	}
});