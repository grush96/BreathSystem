function formatMessage(username, text) {
    return {
        username,
        text
    }
}

function formatTurn(turnID, pcAction) {
    return {
        turnID,
        pcAction
    }
}

module.exports = { 
    formatMessage,
    formatTurn
};