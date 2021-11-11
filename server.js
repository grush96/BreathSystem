const { createServer } = require("http");
const { Server } = require("socket.io");
const { instrument } = require("@socket.io/admin-ui");
const express = require("express");
const cors = require("cors");
const path = require('path');
const { MongoClient } = require("mongodb");
const e = require("cors");
// const { response } = require("express");

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
	socket.on('joinRoom', async ({username, room}) => {
		try {
			let result = await collection.findOne({ "_id": room });
			if (!result) {
				await collection.insertOne({ 
					"_id": room,
					userCount: 0,
				 	users: [],
					messages: [],
					characters: [],
					colors: ["is-dark", "is-primary", "is-link", "is-info", "is-success", "is-warning", "is-danger"]
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

			socket.emit("joinedChat");

			// Send character in combat info
			const characters = await getRoomChars(room);
			io.to(room).emit('characterJoin', characters);
		} catch (e) {
			console.error(e);
		}
	});

	// Listen for chatMessage
	socket.on('chatMessage', async (username, msg) => {
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
	});

	// Listen for add character
	socket.on('addChar', async (username, character, turn, additional) => {
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
	});

	// Listen for get character info
	// TODO: use blueprint of functions below
	socket.on('getChar', async ({room, id, name}) => {
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
	});

	// Listen for remove character
	socket.on('removeChar', async ({ room, id, name }) => {
		removeRoomChar(room, id, name);
		const characters = await getRoomChars(socket.activeRoom);
		io.to(socket.activeRoom).emit('characterJoin', characters);
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
		const characters = await getRoomChars(socket.activeRoom);
		io.to(socket.activeRoom).emit('fullParty', characters);
	});

	socket.on('addTurn', ({ turnID, pcAction }) => {
		io.to(socket.activeRoom).emit('newTurn', {turnID, pcAction});
	});

	socket.on('beginCombat', () => {
		io.to(socket.activeRoom).emit("combatBegins");
	});

	socket.on('nextSecond', () => {
		io.to(socket.activeRoom).emit("nextSecond");
	});

	socket.on('endCombat', () => {
		io.to(socket.activeRoom).emit("combatEnds");
	})

	//Runs when client disconnects
	socket.on('disconnect', async () => {
		const room = socket.activeRoom;

		const user = await getRoomUser(room, socket.id);
		const color = user.color;

		collection.updateOne(
			{ "_id": room }, 
			{ "$pull": { "users": { id: socket.id } } }
		);

		collection.updateOne(
			{ "_id": room }, 
			{ "$push": { "colors": { $each: [color], $position: 0 } } }
		);

		collection.updateOne(
			{ "_id": room }, 
			{ "$inc": { userCount: -1 } }
		);
		
		await delay(100);

		// Send users and room info
		const users = await getRoomUsers(room);
		io.to(room).emit('roomUsers', users);
		
		const cursor = collection.find({ "_id": room });
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
			collection.deleteOne({ "_id": room });
		}
	});
});

async function getRoomUsers(room) {
	await delay(50);

	collection = client.db("datadb").collection("rooms");
	const cursor = collection.find({ "_id": room });
	const results = await cursor.toArray();
	let users;

	if (results.length > 0) {
		users = results[0].users;
	}
	return users;
}

async function getRoomUser(room, userId) {
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
	}

	return user[0];
}

async function getRoomChars(room) {
	await delay(50);

	collection = client.db("datadb").collection("rooms");
	const cursor = collection.find({ "_id": room });
	const results = await cursor.toArray();
	let characters;

	if (results.length > 0) {
		characters = results[0].characters;
	}
	return characters;
}

async function getRoomChar(room, name) {
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
}

async function removeRoomChar(room, id, name) {
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