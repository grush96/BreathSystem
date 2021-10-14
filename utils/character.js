const characters = [];

function characterCreate(character, user, turn, additional) {
    const playerCharacter = { character, user, turn, additional };

    characters.push(playerCharacter);
    //console.log(characters);
    return playerCharacter;
}

function characterLeave(room, id, name) {
    const index = characters.findIndex(playerCharacter => 
        playerCharacter.user.room === room && playerCharacter.user.id === id 
        && playerCharacter.character.name === name);

    if (index !== -1) {
        return characters.splice(index, 1)[0];
    }
}

function getRoomCharacters(room) {
    return characters.filter(playerCharacter => playerCharacter.user.room === room);
}

// TODO: think if there is better way to do
//       could implement wait ... seconds before removing
function removeRoomCharacters(room) {
    const roomChars = getRoomCharacters(room);
    for (let i = 0; i < roomChars.length; i++) {
        characterLeave(roomChars[i].user.room, roomChars[i].user.id, 
            roomChars[i].character.name);
    };
}

module.exports = {
    characterCreate,
    characterLeave,
    getRoomCharacters,
    removeRoomCharacters
};