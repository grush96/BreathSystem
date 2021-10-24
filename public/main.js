var { username, room } = Qs.parse(location.search, {
	ignoreQueryPrefix: true
});

room = room.toLowerCase();

const socket = io();

// Join chatroom
socket.emit('joinRoom', { username, room });

// LANDING PAGE
// Get room and users
socket.on('roomUsers', ({ room, users }) => {
	outputRoomName(room);
	outputUsers(users);
});

disableDMButtons();

// New character from server
socket.on('characterJoin', characters => {
	outputCharacter(characters);
	// Allow for removal of character from combat
	if (document.getElementById("remove-char")) {
	    document.getElementById("remove-char").onclick = function() {
	        console.log("works so far");
	        socket.emit('removeChar', playerChar);
	    };
	};
});

// Output character to DOM
function outputCharacter(characters) {
	const characterList = document.getElementById('character-desc');
	const characterNum = document.getElementById('combat-chars');
	characterList.innerHTML = `
		${characters.map(playerChar => 
			`<div class="notification is-dark">
				<a class="button edit-character" style="float: right">Edit</a>
				<p class="is-size-3 char-name">${playerChar.character.name}</p>
				<a class="button remove-char" style="float: right">Remove</a>
				<div class="remove-info" type="hidden" room="${playerChar.user.room}" 
					id="${playerChar.user.id}" name="${playerChar.character.name}"
                    player="${playerChar.user.username}"></div>
				<p class="is-size-6">Player: ${playerChar.user.username}</p>
			</div>`
		).join('')}
	`;

	characterNum.innerText = characterList.children.length;
    
    const playerButtons = document.getElementsByClassName('edit-character');
    for (let i = 0; i < playerButtons.length; i++) {
        const owner = playerButtons[i].nextElementSibling
            .nextElementSibling.nextElementSibling.getAttribute('player');
        console.log(`${username} !== ${owner}`)
        if (username !== owner) {
            playerButtons[i].classList.add('is-hidden');
        }
    }
    
    const pdButtons = document.getElementsByClassName('remove-char');
    for (let i = 0; i < pdButtons.length; i++) {
        const owner = pdButtons[i].nextElementSibling.getAttribute('player');
        if (username !== owner && username != "DM") {
            pdButtons[i].classList.add('is-hidden');
        }
    }

	var removeButton = document.getElementsByClassName('remove-char');

	for(let i = 0; i < removeButton.length; i++) {
		removeButton[i].addEventListener("click", function() {
			const info = removeButton[i].nextElementSibling;
			const room = info.getAttribute('room');
			const id = info.getAttribute('id');
			const name = info.getAttribute('name');
			console.log("this works");
			socket.emit('removeChar', ({room, id, name}));
		});
	}
}

// TODO: use as template for edit character button (but use info)
document.getElementById('new-character-button').addEventListener("click", function() {
    document.getElementById("char-name").value = "";
    document.getElementById("init-bonus").value = "";
    if (document.getElementsByClassName('extra-action')[0]) {
        const extraAction = document.getElementsByClassName('extra-action')[0];
        extraAction.parentNode.removeChild(extraAction);
    }
    var turns = document.getElementById('turn').childNodes;
    for (let i = 0; i < turns.length - 1; i++) {
        resetBaseContainer(turns[i]);
        resetActionContainer(turns[i]);
        resetBonusContainer(turns[i]);
    }
    numberTurns();
    document.getElementsByClassName('new-character')[0].classList.remove('is-hidden');
});

function resetBaseContainer(baseContainer) {
    baseContainer.classList = "notification row";
        
    baseContainer.getElementsByClassName('turn-title')[0].innerText = "None";
    var turnChoices = baseContainer.getElementsByClassName('turn-option');
    for (let j = 0; j < turnChoices.length - 1; j++) {
        turnChoices[j].classList.remove('is-active');
    }
    turnChoices[4].classList.add('is-active');
}

function resetActionContainer(actionContainer) {
    actionContainer.getElementsByClassName('action-dropdowns')[0].classList.add('is-hidden');
    actionContainer.getElementsByClassName('action-title')[0].innerText = "Choose Action";
    var actionChoices = actionContainer.getElementsByClassName('action-option');
    for (let j = 0; j < actionChoices.length; j++) {
        actionChoices[j].classList.remove('is-active');
    }
    actionContainer.getElementsByClassName('additional-actions')[0].classList.add('is-hidden');
    actionContainer.getElementsByClassName('optional-actions')[0].classList.add('is-hidden');
    actionContainer.getElementsByClassName('base-actions')[0].classList.remove('is-hidden');
    actionContainer.getElementsByClassName('action-desc')[0].classList.add('is-hidden');
    actionContainer.getElementsByClassName('action-input')[0].value = "";
    actionContainer.getElementsByClassName('action-extra')[0].classList.add('is-hidden');
    actionContainer.getElementsByClassName('extra-attack-bool')[0].checked = false;
    const actionSurge = document.getElementsByClassName('action-surge')[0];
    if (actionSurge) {
        actionSurge.parentNode.removeChild(actionSurge);
        numberTurns();
    }
}

function resetBonusContainer(bonusContainer) {
    bonusContainer.getElementsByClassName('bonus-dropdowns')[0].classList.add('is-hidden');
    bonusContainer.getElementsByClassName('bonus-title')[0].innerText = "Choose Bonus Action";
    var bonusChoices = bonusContainer.getElementsByClassName('bonus-option');
    for (let j = 0; j < bonusChoices.length; j++) {
        bonusChoices[j].classList.remove('is-active');
    }
    bonusContainer.getElementsByClassName('class-bonus')[0].classList.add('is-hidden');
    bonusContainer.getElementsByClassName('optional-bonus')[0].classList.add('is-hidden');
    bonusContainer.getElementsByClassName('base-bonus')[0].classList.remove('is-hidden');
    bonusContainer.getElementsByClassName('bonus-desc')[0].classList.add('is-hidden');
    bonusContainer.getElementsByClassName('bonus-input')[0].value = "";
}

function enableLandingButton() {
	document.getElementById('to-landing').addEventListener("click", function() {
		console.log("back button pressed");
		if (username === "DM") {
			socket.emit('endCombat');
		}

		document.getElementById('combat-page').classList.add('is-hidden');
        document.getElementById('character-page').classList.remove('is-hidden');
	});
}

document.getElementById('to-combat').addEventListener("click", function() {
	socket.emit("beginCombat");
	socket.emit('getParty', room);
});

socket.on("combatBegins", () => {
	var combatPage = document.getElementById('combat-page');
    document.getElementById('character-page').classList.add('is-hidden');
    combatPage.classList.remove('is-hidden');
    
    var combatOutput = document.createElement('div');
    combatOutput.classList.add('block');
    combatOutput.classList.add('combat-output');
    combatOutput.innerHTML = 
        `<div class="tile is-parent is-12">
            <div class="tile box is-child is-hidden">
                <p class="title has-text-centered">End of Round <span id="round-num">1</span></p>
            </div>
        </div>
        <div class="tile is-ancestor is-warning row">
            <div class="tile is-parent is-4">
                <div class="card tile is-child">
                    <header class="card-header">
                        <p class="card-header-title">First Second</p>
                        <block class="card-header-icon turn-toggle" aria-label="more options">
                            <span class="icon">
                                <i class="fas fa-angle-down" aria-hidden="true"></i>
                            </span>
                        </block>
                    </header>
                    <div class="card-content">
                        <div id="first-second"></div>
                    </div>
                </div>
            </div>
            <div class="tile is-parent is-4">
                <div class="card tile is-child is-hidden">
                    <header class="card-header">
                        <p class="card-header-title">Sixth Second</p>
                        <block class="card-header-icon turn-toggle" aria-label="more options">
                            <span class="icon">
                                <i class="fas fa-angle-down" aria-hidden="true"></i>
                            </span>
                        </block>
                    </header>
                    <div class="card-content">
                        <div id="sixth-second"></div>
                    </div>
                </div>
            </div>
            <div class="tile is-parent is-4">
                <div class="card tile is-child is-hidden">
                    <header class="card-header">
                        <p class="card-header-title">Fifth Second</p>
                        <block class="card-header-icon turn-toggle" aria-label="more options">
                            <span class="icon">
                                <i class="fas fa-angle-down" aria-hidden="true"></i>
                            </span>
                        </block>
                    </header>
                    <div class="card-content">
                        <div id="fifth-second"></div>
                    </div>
                </div>
            </div>
            <div class="tile is-parent is-4">
                <div class="card tile is-child is-hidden">
                    <header class="card-header">
                        <p class="card-header-title">Fourth Second</p>
                        <block class="card-header-icon turn-toggle" aria-label="more options">
                            <span class="icon">
                                <i class="fas fa-angle-down" aria-hidden="true"></i>
                            </span>
                        </block>
                    </header>
                    <div class="card-content">
                        <div id="fourth-second"></div>
                    </div>
                </div>
            </div>
            <div class="tile is-parent is-4">
                <div class="card tile is-child is-hidden">
                    <header class="card-header">
                        <p class="card-header-title">Third Second</p>
                        <block class="card-header-icon turn-toggle" aria-label="more options">
                            <span class="icon">
                                <i class="fas fa-angle-down" aria-hidden="true"></i>
                            </span>
                        </block>
                    </header>
                    <div class="card-content">
                        <div id="third-second"></div>
                    </div>
                </div>
            </div>
            <div class="tile is-parent is-4">
                <div class="card tile is-child is-hidden">
                    <header class="card-header">
                        <p class="card-header-title">Second Second</p>
                        <block class="card-header-icon turn-toggle" aria-label="more options">
                            <span class="icon">
                                <i class="fas fa-angle-down" aria-hidden="true"></i>
                            </span>
                        </block>
                    </header>
                    <div class="card-content">
                        <div id="second-second"></div>
                    </div>
                </div>
            </div>
        </div>`;
    
    console.log(combatPage);
    if (combatPage.getElementsByClassName('combat-output')[0]) {
        combatPage.removeChild(combatPage.getElementsByClassName('combat-output')[0]);
    }
    combatPage.appendChild(combatOutput);

    enableLandingButton();
    disableDMButtons();
    enableTurnDropdowns();

    if (username === "DM") {
		document.getElementById('continue-combat').classList.remove('is-hidden');
	}
});

function enableTurnDropdowns() {
    let turnToggle = document.getElementsByClassName('turn-toggle');
    for (let i = 0; i < turnToggle.length; i++) {
        console.log("for loop");
        turnToggle[i].addEventListener("click", function(event) {
            console.log("click");
            let targetElement = event.target || event.srcElement;
            console.log(targetElement);
            findAncestor(targetElement, '.card').getElementsByClassName('card-content')[0].classList.toggle('is-hidden');
        });
    }
}

// TODO: may need to make into function to add to "on combat"
var continueButton = document.getElementById('continue-combat'); 
continueButton.addEventListener("click", function() {
    const turns = [ "first-second", "second-second", "third-second", "fourth-second", "fifth-second", "sixth-second"];
    console.log(sizeOfTurn);
    if (continueButton.innerText === "Start Combat" || continueButton.innerText === "Next Second") {
        continueButton.innerText = "Continue Combat";
    }
    for (let i = 0; i < 6; i++) { 
        if (combat[i].length > 0) {
            if (i !== 0 && combat[i].length === sizeOfTurn[i]) {
                socket.emit('nextSecond');
            }
            const pcAction = combat[i][0];
            const turnID = turns[i];
            socket.emit('addTurn', { turnID, pcAction });
            combat[i].splice(0, 1);
            if (i !== 5 && combat[i].length === 0) {
                continueButton.innerText = "Next Second"
            } else if (i === 5 && combat[5].length === 0) {
                console.log("end of combat reached");
                socket.emit('endCombat');
            }
            i = 6;
        }
    }
});

// CURRENT

// Add room name to DOM
function outputRoomName(room) {
	document.getElementById('room-name').innerText = room;
}

// Add users to DOM
function outputUsers(users) {
	const userList = document.getElementById('players');
	userList.innerHTML = `
		${users.map(user => 
			`<li><a class="player-name">${user.username}</a></li>`
		).join('')}
	`;
}

// TODO: when using databases may be cleaner way to implement 
//       instead of just checking name, check owner of room/socket.id
function disableDMButtons() {
	if (username !== "DM") {
        const dmButtons = document.getElementsByClassName('dm-button');
		for(let i = 0; i < dmButtons.length; i++) {
			dmButtons[i].classList.add('is-hidden');
		}
	}
}

// Message from server
socket.on('message', message => {
	outputMessage(message);

	// Scroll down
	const chatMessages = document.querySelector('.chat-messages');
	chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Message submit
const chatForm = document.getElementById('chat-form');
chatForm.addEventListener('submit', e => {
	e.preventDefault();

	// Get message text
	const msg = e.target.elements.msg.value;

	// Emit message to server
	socket.emit('chatMessage', msg);

	// Clear input
	e.target.elements.msg.value = '';
	e.target.elements.msg.focus();
});

// Output message to DOM
function outputMessage(message) {
	const div = document.createElement('div');
	div.classList.add('notification');
	div.classList.add('is-dark');
    div.classList.add('chat-message');
	div.innerHTML = `<p>${message.username}: ${message.text}</p>`;
	document.querySelector('.chat-messages').appendChild(div);
	// <p class="text">
	//     ${message.text}
	// </p>
}

// TODO: think about making hide/unhide/toggle hide functions

const turnContainer = document.getElementById('turn');
for (let i = 1; i <= 6; i++) {
    var turnDropdown = document.createElement('div');
    turnDropdown.classList.add('notification');
    turnDropdown.classList.add('row');
    turnDropdown.innerHTML = 
        `<p class="subtitle space-right"><span class="turn-number">${i}.</span></p>
        <div class="dropdown turn-dropdown space-right">
            <div class="dropdown-trigger">
                <button class="button" aria-haspopup="true" aria-controls="dropdown-menu-turn">
                    <span class="turn-title">None</span>
                    <span class="icon is-small">
                        <i class="fas fa-angle-down" aria-hidden="true"></i>
                    </span>
                </button>
            </div>
            <div class="dropdown-menu" id="dropdown-menu-turn" role="menu">
                <div class="dropdown-content">
                    <a class="dropdown-item turn-option">Action</a>
                    <a class="dropdown-item turn-option">Bonus Action</a>
                    <a class="dropdown-item turn-option">Movement</a>
                    <a class="dropdown-item turn-option">Breath</a>
                    <a class="dropdown-item turn-option is-active">None</a>
                </div>
            </div>
        </div>
        <div class="action-dropdowns is-hidden row">
            <div class="dropdown action-dropdown">
                <div class="dropdown-trigger">
                    <button class="button" aria-haspopup="true" aria-controls="dropdown-menu-action">
                        <span class="icon is-small is-left is-hidden">
                            <i class="fas fa-exclamation-triangle"></i>
                        </span>
                        <span class="action-title">Choose Action</span>
                        <span class="icon is-small is-right">
                            <i class="fas fa-angle-down" aria-hidden="true"></i>
                        </span>
                    </button>
                </div>
                <div class="dropdown-menu" id="dropdown-menu-action" role="menu">
                    <div class="dropdown-content base-actions">
                        <a class="dropdown-item action-option extra-attack">Martial Attack</a>
                        <a class="dropdown-item action-option desc">Spell</a>
                        <hr class="dropdown-divider">
                        <a class="dropdown-item to-additional-actions">Additional Actions</a>
                        <hr class="dropdown-divider">
                        <a class="dropdown-item to-optional-actions">Optional Actions</a>
                        <hr class="dropdown-divider">
                        <a class="dropdown-item action-option surge">Action Surge</a>
                        <a class="dropdown-item action-option desc">Use Item</a>
                        <a class="dropdown-item action-option desc">Other</a>
                    </div>
                    <div class="dropdown-content additional-actions is-hidden">
                        <a class="dropdown-item to-actions">
                            <span class="icon is-small">
                                <i class="fas fa-angle-left" aria-hidden="true"></i>
                            </span>
                            <span>Back</Span>
                        </a>
                        <hr class="dropdown-divider">
                        <a class="dropdown-item action-option">Dash</a>
                        <a class="dropdown-item action-option">Disengage</a>
                        <a class="dropdown-item action-option">Dodge</a>
                        <a class="dropdown-item action-option">Escape Grapple</a>
                        <a class="dropdown-item action-option">Grapple</a>
                        <a class="dropdown-item action-option">Help</a>
                        <a class="dropdown-item action-option">Hide</a>
                        <a class="dropdown-item action-option">Improvise</a>
                        <a class="dropdown-item action-option">Search</a>
                        <a class="dropdown-item action-option">Shove</a>
                        <a class="dropdown-item action-option">Stabilize</a>
                    </div>
                    <div class="dropdown-content optional-actions is-hidden">
                        <a class="dropdown-item to-actions">
                            <span class="icon is-small">
                                <i class="fas fa-angle-left" aria-hidden="true"></i>
                            </span>
                            <span>Back</Span>
                        </a>
                        <hr class="dropdown-divider">
                        <a class="dropdown-item action-option">Climb onto Bigger Creature</a>
                        <a class="dropdown-item action-option">Disarm</a>
                        <a class="dropdown-item action-option">Overrun</a>
                        <a class="dropdown-item action-option">Shove Aside</a>
                        <a class="dropdown-item action-option">Tumble</a>
                    </div>
                </div>
            </div>
            <!--  required -->
            
            <div class="field action-desc is-hidden">
                <div class="control has-icons-left has-icons-right">
                <input class="input action-input" type="text" placeholder="??" autocomplete="off" />
                    <span class="icon is-small is-left">
                        <i class="fas fa-scroll"></i>
                    </span>
                    <span class="icon is-small has-text-danger is-right is-hidden">
                        <i class="fas fa-exclamation-triangle"></i>
                    </span>
                </div>
                <p class="help is-hidden">Please enter description</p>
            </div>
            <label class="checkbox action-extra is-hidden">
                <input type="checkbox" class="extra-attack-bool">
                Extra Attack
            </label>
            </br>
            <p class="help action-note is-hidden">Please choose a specific action</p>
        </div>
        <div class="bonus-dropdowns is-hidden">
            <div class="dropdown bonus-dropdown">
                <div class="dropdown-trigger">
                    <button class="button" aria-haspopup="true" aria-controls="dropdown-menu-bonus">
                        <span class="icon is-small is-left is-hidden">
                            <i class="fas fa-exclamation-triangle"></i>
                        </span>
                        <span class="bonus-title">Choose Bonus Action</span>
                        <span class="icon is-small is-right">
                            <i class="fas fa-angle-down" aria-hidden="true"></i>
                        </span>
                    </button>
                </div>
                <div class="dropdown-menu" id="dropdown-menu-bonus" role="menu">
                    <div class="dropdown-content base-bonus">
                        <a class="dropdown-item bonus-option">Off-Hand Attack</a>
                        <a class="dropdown-item bonus-option desc">Spell</a>
                        <hr class="dropdown-divider">
                        <a class="dropdown-item to-class-bonus">Class Bonus Actions</a>
                        <hr class="dropdown-divider">
                        <a class="dropdown-item to-optional-bonus">Optional Bonus Actions</a>
                        <hr class="dropdown-divider">
                        <a class="dropdown-item bonus-option desc">Use Item</a>
                        <a class="dropdown-item bonus-option desc">Other</a>
                    </div>
                    <div class="dropdown-content class-bonus is-hidden">
                        <a class="dropdown-item to-bonus">
                            <span class="icon is-small">
                                <i class="fas fa-angle-left" aria-hidden="true"></i>
                            </span>
                            <span>Back</Span>
                        </a>
                        <hr class="dropdown-divider">
                        <a class="dropdown-item bonus-option">Rage (Barbarian)</a>
                        <a class="dropdown-item bonus-option">Bardic Inspiration (Bard)</a>
                        <a class="dropdown-item bonus-option">Second Wind (Fighter)</a>
                        <a class="dropdown-item bonus-option">Unarmed Strike (Monk)</a>
                        <a class="dropdown-item bonus-option">Dodge (Monk)</a>
                        <a class="dropdown-item bonus-option">Dash (Monk/Rogue)</a>
                        <a class="dropdown-item bonus-option">Disengage (Monk/Rogue)</a>
                        <a class="dropdown-item bonus-option">Hide (Rogue)</a>
                        <a class="dropdown-item bonus-option">Spell Slots = Sorc. Points (Sorcerer)</a>
                        <a class="dropdown-item bonus-option desc">Quickened Spell (Sorcerer)</a>
                    </div>
                    <div class="dropdown-content optional-bonus is-hidden">
                        <a class="dropdown-item to-bonus">
                            <span class="icon is-small">
                                <i class="fas fa-angle-left" aria-hidden="true"></i>
                            </span>
                            <span>Back</Span>
                        </a>
                        <hr class="dropdown-divider">
                        <a class="dropdown-item bonus-option">Overrun</a>
                        <a class="dropdown-item bonus-option">Tumble</a>
                    </div>
                </div>
            </div>
            <div class="field bonus-desc is-hidden">
                <div class="control has-icons-left has-icons-right">
                    <input class="input bonus-input" type="text" placeholder="??" autocomplete="off" /> 
                    <span class="icon is-small is-left">
                        <i class="fas fa-scroll"></i>
                    </span>
                    <span class="icon is-small has-text-danger is-right is-hidden">
                        <i class="fas fa-exclamation-triangle"></i>
                    </span>
                </div>
                <p class="help is-hidden">Please enter description</p>
            </div>
            <p class="help bonus-note is-hidden">Please choose a specific bonus action</p>
        </div>`
    turnContainer.appendChild(turnDropdown);
}

// Closes all dropdowns if anywhere others than dropdown triggers is clicked,
// this also includes within the dropdown menus
document.getElementsByClassName('hero')[0].addEventListener("click", function() {
    closeDropdowns();
});

// Allows for draggale divs in Turn Order section, limits number of divs based
// on action count updating both on adding to and altering list
Sortable.create(turn, {
    animation: 200,
    group: "shared",
    sort: true,
    // handle: ".notification:not(.turn-dropdown)",
    // touchStartThreshold: 100,
    delay: 20,
    delayOnTouchOnly: true,
        
    onSort: function () {
        numberTurns();
    },
});

// Response to click on any spcecific turn dropdown item
var turnChoices = document.getElementsByClassName('turn-option');
for (let i = 0; i < turnChoices.length; i++) {
    turnChoices[i].addEventListener("click", function(event) {
        var turns = document.getElementById('turn');
        var targetElement = event.target || event.srcElement;
        var turnContainer = targetElement.parentElement.parentElement.parentElement.parentElement;
        var turnChoices = turnContainer.getElementsByClassName('turn-option');
        var actionDropdowns = turnContainer.getElementsByClassName('action-dropdowns')[0];
        var bonusDropdowns = turnContainer.getElementsByClassName('bonus-dropdowns')[0];
        // Replaces dropdown trigger name
        turnTitle = targetElement.innerText;
        turnContainer.getElementsByClassName('turn-title')[0].innerText = turnTitle;
        
        // Highlights chosen turn item
        for (let k = 0; k < turnChoices.length; k++) {
            turnChoices[k].classList.remove('is-active');
        }
        targetElement.classList.add('is-active');
        
        // Adds and removes correct subsequent dropdown(s)
        actionDropdowns.classList.add('is-hidden');
        bonusDropdowns.classList.add('is-hidden');
        if (turnTitle === "Action") {
            if (turns.getElementsByClassName('is-action')[0] 
                    && turnContainer.className !== "notification row is-action") {
                var wrongActionContainer = turns.getElementsByClassName('is-action')[0];
                if (document.getElementsByClassName('extra-action')[0]) {
                    const extraAction = document.getElementsByClassName('extra-action')[0];
                    extraAction.parentNode.removeChild(extraAction);
                }
                resetBaseContainer(wrongActionContainer);
                resetActionContainer(wrongActionContainer);
            }
            turnContainer.className = "notification row is-action";
            actionDropdowns.classList.remove('is-hidden');
            watchActionChoice(turnContainer);
        } else if (turnTitle === "Bonus Action") {
            if (turns.getElementsByClassName('is-bonus-action')[0] 
                    && turnContainer.className !== "notification row is-bonus-action") {
                var wrongBonusContainer = turns.getElementsByClassName('is-bonus-action')[0];
                resetBaseContainer(wrongBonusContainer);
                resetBonusContainer(wrongBonusContainer);
            }
            turnContainer.className = "notification row is-bonus-action";
            bonusDropdowns.classList.remove('is-hidden');
            watchBonusChoice(turnContainer);
        } else if (turnTitle === "Movement") {
            turnContainer.className = "notification row is-movement";
        } else if (turnTitle === "Breath") {
            turnContainer.className = "notification row is-breath";
        } else {
            turnContainer.className = "notification row";
        }
        numberTurns();
        if (turns.childNodes[5].getElementsByClassName('turn-number')[0].innerText === "6-7.") {
            turns.appendChild(turns.removeChild(turns.childNodes[4]));
            numberTurns();
        }
    });
}

const getOffsetTop = element => {
    let offsetTop = 0;
    while(element) {
        offsetTop += element.offsetTop;
        element = element.offsetParent;
    }
    return offsetTop;
}

function dropdownDirection(targetElement) {
    if (document.body.clientHeight - findAncestor(targetElement, '.dropdown').offsetHeight - getOffsetTop(findAncestor(targetElement, '.dropdown')) 
            < findAncestor(targetElement, '.dropdown').querySelector('.dropdown-content:not(.is-hidden)').offsetHeight) {
        findAncestor(targetElement, '.dropdown').classList.add('is-up');
    } else {
        findAncestor(targetElement, '.dropdown').classList.remove('is-up');
    }
}

// Response to click on main turn dropdown trigger
var turnDropdown = document.getElementsByClassName('turn-dropdown');
for (let i = 0; i < turnDropdown.length; i++) {
    turnDropdown[i].addEventListener("click", function(event) { 
        var targetElement = event.target || event.srcElement;
        const toggled = findAncestor(targetElement, '.turn-dropdown').classList.contains('is-active');
        closeDropdowns();
        if (!toggled) {
            findAncestor(targetElement, '.turn-dropdown').classList.add('is-active');
        }
        dropdownDirection(targetElement);
        event.stopPropagation();
    });
}

// Response to click on action option dropdown trigger
var actionDropdown = document.getElementsByClassName('action-dropdown');
for (let i = 0; i < actionDropdown.length; i++) {
    actionDropdown[i].addEventListener("click", function(event) {
        var targetElement = event.target || event.srcElement;
        const toggled = findAncestor(targetElement, '.action-dropdown').classList.contains('is-active');
        closeDropdowns();
        if (!toggled) {
            findAncestor(targetElement, '.action-dropdown').classList.add('is-active');
        }
        dropdownDirection(targetElement);
        event.stopPropagation();
    });
}

var actionChoices = document.getElementsByClassName('action-option');
for (let i = 0; i < actionChoices.length; i++) {
    actionChoices[i].addEventListener("click", function(event) {
        var targetElement = event.target || event.srcElement;
        var actionDropdown = targetElement.parentElement.parentElement.parentElement;
        // Replaces dropdown trigger name
        const actionTitle = targetElement.innerText;
        actionDropdown.getElementsByClassName('action-title')[0].innerText = actionTitle;
        
        // Highlights chosen action item
        var currentChoices = actionDropdown.getElementsByClassName('action-option');
        for (let j = 0; j < currentChoices.length; j++) {
            currentChoices[j].classList.remove('is-active');
        }
        targetElement.classList.add('is-active');
        
        // Adds and removes correct subsequent options
        var turnContainer = actionDropdown.parentElement;
        turnContainer.getElementsByClassName('action-extra')[0].classList.add("is-hidden");
        turnContainer.getElementsByClassName('action-desc')[0].classList.add("is-hidden");
        const actionSurge = document.getElementsByClassName('action-surge')[0];
        if (actionSurge) {
            actionSurge.parentNode.removeChild(actionSurge);
            numberTurns();
        }
        if (targetElement.classList.contains('extra-attack')) {
            turnContainer.getElementsByClassName('action-extra')[0].classList.remove("is-hidden");
        } else if (targetElement.classList.contains('desc')) {
            turnContainer.getElementsByClassName('action-desc')[0].classList.remove("is-hidden");
        } else if (targetElement.classList.contains('surge')) {
            const actionSurge = document.createElement('div');
            actionSurge.classList.add('notification');
            actionSurge.classList.add('row');
            actionSurge.classList.add('is-action');
            actionSurge.classList.add('action-surge');
            actionSurge.innerHTML = `<p class="subtitle space-right"><span class="turn-number">2.</span></p>
                                    <p class="subtitle turn-title">Action Surge</p>`;
            findAncestor(targetElement, '.notification.row').insertAdjacentElement('afterend', actionSurge);
            numberTurns();
        }

        if (turnContainer.getElementsByClassName('action-title')[0].innerText !== "Choose Action") {
            validActions = false;
            turnContainer.querySelectorAll('button')[0].classList.remove('is-danger');
            turnContainer.getElementsByClassName('action-note')[0].classList.add('is-hidden');
            turnContainer.getElementsByClassName('is-left')[0].classList.add('is-hidden');
        }
    });
}

// Switches action dropdown to show additional actions
var toAddActions = document.getElementsByClassName('to-additional-actions');
for (let i = 0; i < toAddActions.length; i++) {
    toAddActions[i].addEventListener("click", function(event) {
        var targetElement = event.target || event.srcElement;
        var actionDropdown = findAncestor(targetElement, '.action-dropdown');
        actionDropdown.getElementsByClassName('base-actions')[0].classList.add('is-hidden');
        actionDropdown.getElementsByClassName('additional-actions')[0].classList.remove('is-hidden');
        dropdownDirection(targetElement);
        event.stopPropagation();
    });
}

// Switches action dropdown to show optional (DMG) actions
var toOptionActions = document.getElementsByClassName('to-optional-actions');
for (let i = 0; i < toOptionActions.length; i++) {
    toOptionActions[i].addEventListener("click", function(event) {
        var targetElement = event.target || event.srcElement;
        var actionDropdown = findAncestor(targetElement, '.action-dropdown');
        actionDropdown.getElementsByClassName('base-actions')[0].classList.add('is-hidden');
        actionDropdown.getElementsByClassName('optional-actions')[0].classList.remove('is-hidden');
        dropdownDirection(targetElement);
        event.stopPropagation();
    });
}

// Switches action dropdown back to show base actions
var toBaseActions = document.getElementsByClassName('to-actions');
for (let i = 0; i < toBaseActions.length; i++) {
    toBaseActions[i].addEventListener("click", function(event) {
        var targetElement = event.target || event.srcElement;
        var actionDropdown = findAncestor(targetElement, '.action-dropdown');
        actionDropdown.getElementsByClassName('additional-actions')[0].classList.add('is-hidden');
        actionDropdown.getElementsByClassName('optional-actions')[0].classList.add('is-hidden');
        actionDropdown.getElementsByClassName('base-actions')[0].classList.remove('is-hidden');
        dropdownDirection(targetElement);
        event.stopPropagation();
    });
}

const checkExtra = document.getElementsByClassName('extra-attack-bool');
for (let i = 0; i < checkExtra.length; i++) {
    checkExtra[i].addEventListener("change", function(event) {
        var targetElement = event.target || event.srcElement;
        if (targetElement.checked) {
            const extraAction = document.createElement('div');
            extraAction.classList.add('notification');
            extraAction.classList.add('row');
            extraAction.classList.add('is-action');
            extraAction.classList.add('extra-action');
            // TODO: need to have correct id??
            // extraAction.setAttribute("id", "-1");
            extraAction.innerHTML = `<p class="subtitle space-right"><span class="turn-number">2.</span></p>
                                    <p class="subtitle turn-title">Extra Attack</p>`;
            findAncestor(targetElement, '.notification.row').insertAdjacentElement('afterend', extraAction);
            numberTurns();
        } else {
            const extraAction = document.getElementsByClassName('extra-action')[0];
            extraAction.parentNode.removeChild(extraAction);
            numberTurns();
        }
    });
}

// Response to click on bonus action option dropdown trigger
var bonusDropdown = document.getElementsByClassName('bonus-dropdown');
for (let i = 0; i < bonusDropdown.length; i++) {
    bonusDropdown[i].addEventListener("click", function(event) {
        var targetElement = event.target || event.srcElement;
        const toggled = findAncestor(targetElement, '.bonus-dropdown').classList.contains('is-active');
        closeDropdowns();
        if (!toggled) {
            findAncestor(targetElement, '.bonus-dropdown').classList.add('is-active');
        }
        dropdownDirection(targetElement);
        event.stopPropagation();
    });
}

var bonusChoices = document.getElementsByClassName('bonus-option');
for (let i = 0; i < bonusChoices.length; i++) {
    bonusChoices[i].addEventListener("click", function(event) {
        var targetElement = event.target || event.srcElement;
        var bonusDropdown = targetElement.parentElement.parentElement.parentElement;
        // Replaces dropdown trigger name
        const bonusTitle = targetElement.innerText;
        bonusDropdown.getElementsByClassName('bonus-title')[0].innerText = bonusTitle;
        
        // Highlights chosen bonus action item
        var currentChoices = bonusDropdown.getElementsByClassName('bonus-option');
        for (let j = 0; j < currentChoices.length; j++) {
            currentChoices[j].classList.remove('is-active');
        }
        targetElement.classList.add('is-active');
        
        // Adds and removes correct subsequent options
        var turnContainer = bonusDropdown.parentElement;
        turnContainer.getElementsByClassName('bonus-desc')[0].classList.add("is-hidden");
        if (targetElement.classList.contains('desc')) {
            turnContainer.getElementsByClassName('bonus-desc')[0].classList.remove("is-hidden");
        }

        if (turnContainer.getElementsByClassName('bonus-title')[0].innerText !== "Choose Bonus Action") {
            validActions = false;
            turnContainer.querySelectorAll('button')[0].classList.remove('is-danger');
            turnContainer.getElementsByClassName('bonus-note')[0].classList.add('is-hidden');
            turnContainer.getElementsByClassName('is-left')[0].classList.add('is-hidden');
        }
    });
}

// Switches bonus action dropdown to show class specific bonus actions
var toClassBonus = document.getElementsByClassName('to-class-bonus');
for (let i = 0; i < toClassBonus.length; i++) {
    toClassBonus[i].addEventListener("click", function(event) {
        var targetElement = event.target || event.srcElement;
        var bonusDropdown = findAncestor(targetElement, '.bonus-dropdown');
        bonusDropdown.getElementsByClassName('base-bonus')[0].classList.add('is-hidden');
        bonusDropdown.getElementsByClassName('class-bonus')[0].classList.remove('is-hidden');
        dropdownDirection(targetElement);
        event.stopPropagation();
    });
}

// Switches bonus action dropdown to show optional (DMG) bonus actions
var toOptionBonus = document.getElementsByClassName('to-optional-bonus');
for (let i = 0; i < toOptionBonus.length; i++) {
    toOptionBonus[i].addEventListener("click", function(event) {
        var targetElement = event.target || event.srcElement;
        var bonusDropdown = findAncestor(targetElement, '.bonus-dropdown');
        bonusDropdown.getElementsByClassName('base-bonus')[0].classList.add('is-hidden');
        bonusDropdown.getElementsByClassName('optional-bonus')[0].classList.remove('is-hidden');
        dropdownDirection(targetElement);
        event.stopPropagation();
    });
}

// Switches bonus action dropdown back to show base bonus actions
var toBaseBonus = document.getElementsByClassName('to-bonus');
for (let i = 0; i < toBaseBonus.length; i++) {
    toBaseBonus[i].addEventListener("click", function(event) {
        var targetElement = event.target || event.srcElement;
        var bonusDropdown = findAncestor(targetElement, '.bonus-dropdown');
        bonusDropdown.getElementsByClassName('class-bonus')[0].classList.add('is-hidden');
        bonusDropdown.getElementsByClassName('optional-bonus')[0].classList.add('is-hidden');
        bonusDropdown.getElementsByClassName('base-bonus')[0].classList.remove('is-hidden');
        dropdownDirection(targetElement);
        event.stopPropagation();
    });
}

function numberTurns() {
    var turnChoices = document.getElementById('turn').getElementsByClassName('turn-number');
    var turnNumber = 0;
    for (let i = 0; i < turnChoices.length; i++) {
        turnNumber++;
        if (turnNumber > 6) {
            turnChoices[i].parentElement.parentElement.classList.add('is-hidden');
            turnChoices[i].innerText = turnNumber;
        } else {
            if (turnChoices[i].parentElement.parentElement.getElementsByClassName('turn-title')[0] 
                && turnChoices[i].parentElement.parentElement.getElementsByClassName('turn-title')[0].innerText === "Action" 
                && !turnChoices[i].parentElement.parentElement.getElementsByClassName('extra-attack-bool')[0].checked
                && turnChoices[i].parentElement.parentElement.getElementsByClassName('action-title')[0].innerText !== "Action Surge") {
                turnChoices[i].innerText = turnNumber + "-" + (turnNumber + 1) + ".";
                turnNumber++;
            } else {
                turnChoices[i].innerText = turnNumber + ".";
            }
        }
    }
    const hiddenTurn = document.getElementById('turn').querySelector('.is-hidden.notification');
    if (hiddenTurn && hiddenTurn.getElementsByClassName('turn-number')[0].innerText < 7) {
        hiddenTurn.classList.remove('is-hidden');
    }
}

function closeDropdowns() {
    var turnDropdown = document.getElementsByClassName('turn-dropdown');
    var actionDropdown = document.getElementsByClassName('action-dropdown');
    var bonusDropdown = document.getElementsByClassName('bonus-dropdown');
    for (let i = 0; i < turnDropdown.length; i++) {
        turnDropdown[i].classList.remove('is-active'); 
        actionDropdown[i].classList.remove('is-active');
        bonusDropdown[i].classList.remove('is-active');
    }
}

function findAncestor(element, selector) {
    while ((element = element.parentElement) 
            && !((element.matches || element.matchesSelector).call(element,selector)));
    return element;
}

document.getElementById('char-cancel').addEventListener("click", function() {
    document.getElementsByClassName('new-character')[0].classList.add('is-hidden');
});

document.getElementById('char-submit').addEventListener("click", function() {
    const nameField = document.getElementById("char-name");
    const initField = document.getElementById("init-bonus");

    const nameValid = validateField(nameField);
    const initValid = validateField(initField);
    const actionContainer = document.getElementsByClassName('is-action')[0];
    const bonusContainer = document.getElementsByClassName('is-bonus-action')[0];
    let validActions = true;


    if (actionContainer) {
        if (actionContainer.getElementsByClassName('action-title')[0].innerText === "Choose Action") {
            validActions = false;
            actionContainer.querySelectorAll('button')[1].classList.add('is-danger');
            actionContainer.getElementsByClassName('action-note')[0].classList.remove('is-hidden');
            actionContainer.getElementsByClassName('is-left')[0].classList.remove('is-hidden');
        } else {
            actionContainer.querySelectorAll('button')[1].classList.remove('is-danger');
            actionContainer.getElementsByClassName('action-note')[0].classList.add('is-hidden');
            actionContainer.getElementsByClassName('is-left')[0].classList.add('is-hidden');
        }
        const actionDesc = actionContainer.getElementsByClassName('action-desc')[0];
        if (!actionDesc.classList.contains('is-hidden')) {
            validateField(actionDesc.getElementsByClassName('action-input')[0]);
        }
    }
    // TODO: ensure if action/bonus is hidden does not result in unsubmittable form
    if (bonusContainer) {
        if (bonusContainer.getElementsByClassName('bonus-title')[0].innerText === "Choose Bonus Action") {
            validActions = false;
            bonusContainer.querySelectorAll('button')[2].classList.add('is-danger');
            bonusContainer.getElementsByClassName('bonus-note')[0].classList.remove('is-hidden');
            bonusContainer.getElementsByClassName('is-left')[1].classList.remove('is-hidden');
        } else {
            bonusContainer.querySelectorAll('button')[2].classList.remove('is-danger');
            bonusContainer.getElementsByClassName('bonus-note')[0].classList.add('is-hidden');
            bonusContainer.getElementsByClassName('is-left')[1].classList.add('is-hidden');
        }
        const bonusDesc = bonusContainer.getElementsByClassName('bonus-desc')[0];
        if (!bonusDesc.classList.contains('is-hidden')) {
            validateField(bonusDesc.getElementsByClassName('bonus-input')[0]);
        }
    }

    if (nameValid && initValid && validActions) {
        const name = nameField.value;
        const init = initField.value;
        if (name === '' || init === '') {
            window.alert("Please enter character name and/or initiative bonus.");
        } else {
            const character = { name, init };
            var turn = [];
            var actionOption = "None";
            var bonusOption = "None";
            var actionDesc = "None";
            var bonusDesc = "None";
            const turnChoices = document.getElementById('turn').querySelectorAll('.notification.row');
            for (let i = 0; i < turnChoices.length; i++) {
                if (!turnChoices[i].classList.contains('is-hidden')) {
                    const turnOption = turnChoices[i].getElementsByClassName('turn-title')[0].innerText;
                    if (turnOption === "Action") {
                        actionOption = turnChoices[i].getElementsByClassName('action-title')[0].innerText;
                        if (!turnChoices[i].getElementsByClassName('action-desc')[0].classList.contains('is-hidden')) {
                            actionDesc = turnChoices[i].getElementsByClassName('action-input')[0].value;
                        }
                        // CURRENT: add action surge condition
                        if (turnChoices[i].getElementsByClassName('extra-attack-bool')[0].checked) {
                            turn.push(turnOption);
                        } else {
                            // TODO: figure out exactly how to present (also could push action/bonus option instead)
                            turn.push(turnOption + " 1");
                            turn.push(turnOption + " 2");
                        }
                    } else if (turnOption === "Bonus Action") {
                        bonusOption = turnChoices[i].getElementsByClassName('bonus-title')[0].innerText;
                        if (!turnChoices[i].getElementsByClassName('bonus-desc')[0].classList.contains('is-hidden')) {
                            bonusDesc = turnChoices[i].getElementsByClassName('bonus-input')[0].value;
                        }
                        turn.push(turnOption);
                    } else {
                        turn.push(turnOption);
                    }
                }
            }
            const additional = { actionOption, bonusOption, actionDesc, bonusDesc };
            console.log("character: " + character.name + " " + character.init);
            console.log("turn: " + turn);
            console.log("additional: " + additional.actionOption + " " + additional.bonusOption);
            socket.emit('addChar', { character, turn, additional });

            document.getElementsByClassName('new-character')[0].classList.add('is-hidden');
        }
    }
});

document.getElementById("char-name").addEventListener("focusout", function() {
    validateField(document.getElementById("char-name"));
});

document.getElementById("init-bonus").addEventListener("focusout", function() {
    validateField(document.getElementById("init-bonus"));
});

function watchActionChoice(actionContainer) {
    actionContainer.getElementsByClassName('action-desc')[0].addEventListener("focusout", function() {
        const actionDesc = actionContainer.getElementsByClassName('action-desc')[0];
        if (!actionDesc.classList.contains('is-hidden')) {
            validateField(actionDesc.getElementsByClassName('action-input')[0]);
        }
    });
}

function watchBonusChoice(bonusContainer) {
    bonusContainer.getElementsByClassName('bonus-desc')[0].addEventListener("focusout", function() {
        const bonusDesc = bonusContainer.getElementsByClassName('bonus-desc')[0];
        if (!bonusDesc.classList.contains('is-hidden')) {
            validateField(bonusDesc.getElementsByClassName('bonus-input')[0]);
        }
    });
}

function validateField(field) {
    let valid = true;
    if (!field.value) {
        valid = false;
        // roomField.style.backgroundColor = "#FF9785";
        // roomField.style.borderColor = "#D12100"
        field.classList.add('is-danger');
        field.parentElement.getElementsByClassName('is-right')[0].classList.remove('is-hidden');
        field.parentElement.parentElement.getElementsByClassName('help')[0].classList.remove('is-hidden');
    } else {
        // roomField.style.backgroundColor = "#fff";
        // roomField.style.borderColor = "#dbdbdb";
        field.classList.remove('is-danger');
        field.parentElement.getElementsByClassName('is-right')[0].classList.add('is-hidden');
        field.parentElement.parentElement.getElementsByClassName('help')[0].classList.add('is-hidden');
    }
    return valid;
}

// SIDEBARS
// Room Info Sidebar
document.getElementById('room-info-title').addEventListener("click", function() {
    document.getElementById('chat-body').classList.add('is-hidden');
    document.getElementById('chat-title').classList.remove('is-active');
    document.getElementById('faq-body').classList.add('is-hidden');
    document.getElementById('faq-title').classList.remove('is-active');
    document.getElementById('room-info-body').classList.toggle('is-hidden');
    document.getElementById('room-info-title').classList.toggle('is-active');
});

// Chat Sidebar
document.getElementById('chat-title').addEventListener("click", function() {
    document.getElementById('room-info-body').classList.add('is-hidden');
    document.getElementById('room-info-title').classList.remove('is-active');
    document.getElementById('faq-body').classList.add('is-hidden');
    document.getElementById('faq-title').classList.remove('is-active');
    document.getElementById('chat-body').classList.toggle('is-hidden');
    document.getElementById('chat-title').classList.toggle('is-active');
});

// FAQ Sidebar
document.getElementById('faq-title').addEventListener("click", function() {
    document.getElementById('chat-body').classList.add('is-hidden');
    document.getElementById('chat-title').classList.remove('is-active');
    document.getElementById('room-info-body').classList.add('is-hidden');
    document.getElementById('room-info-title').classList.remove('is-active');
    document.getElementById('faq-body').classList.toggle('is-hidden');
    document.getElementById('faq-title').classList.toggle('is-active');
});

// COMBAT PAGE
socket.on('fullParty', fullParty => {
	party = fullParty;
	partySetup(party);
});

var combat = [ [], [], [], [], [], [] ];
var sizeOfTurn = [];
function partySetup(party) {
    combat = [ [], [], [], [], [], [] ];
	var characterBreath = new Map();
	party.forEach(function (pc) {
		characterBreath.set(pc.character.name, false);
		for (let i = 0; i < 6; i++) {
			if (pc.turn[i] !== "None") {
				combat[i].push({ 
					init: Math.floor(Math.random() * 20 + 1) 
						+ parseFloat(pc.character.init) 
						+ characterBreath.get(pc.character.name) * 20,
					bonus: pc.character.init,
					name: pc.character.name, 
					action: pc.turn[i],
					desc: pc.additional
				});
				if (pc.turn[i] === "Breath") {
					characterBreath.set(pc.character.name, true);
				} else {
					characterBreath.set(pc.character.name, false);
				}
			}
		}
	});
	combat.forEach(function (turn) {
		turn.sort((a,b) => (b.init - a.init) || (b.bonus - a.bonus) 
		|| (Math.floor(Math.random() * 2) * 2 - 1));
	});
    sizeOfTurn = [];
    for (let i = 0; i < combat.length; i ++) {
        sizeOfTurn.push(combat[i].length);
    }
};

socket.on('newTurn', turnDesc => {
    console.log(turnDesc);
	var div = document.createElement('div');
	div.classList.add('notification');
	div.classList.add('is-dark');
	var pcAction = turnDesc.pcAction;
	if (pcAction.action.includes("Action")) {
		if (pcAction.desc.actionDesc === "None") {
			div.innerHTML = `<p>${pcAction.init} - ${pcAction.name}: ${pcAction.action}<br/>(${pcAction.desc.actionOption})</p>`;
		} else {
			div.innerHTML = `<p>${pcAction.init} - ${pcAction.name}: ${pcAction.action}<br/>(${pcAction.desc.actionOption}: ${pcAction.desc.actionDesc})</p>`;
		}
	} else if (pcAction.action === "Bonus Action") {
		if (pcAction.desc.bonusDesc === "None") {
			div.innerHTML = `<p>${pcAction.init} - ${pcAction.name}: ${pcAction.action}<br/>(${pcAction.desc.bonusOption})</p>`;
		} else {
			div.innerHTML = `<p>${pcAction.init} - ${pcAction.name}: ${pcAction.action}<br/>(${pcAction.desc.bonusOption}: ${pcAction.desc.bonusDesc})</p>`;
		}
    } else if (pcAction.action === "Movement") {
        div.innerHTML = `<p>${pcAction.init} - ${pcAction.name}: ${pcAction.action}<br/><input class="input move-dist" type="number" placeholder="ex. 10 ft." required></p>`;
	} else {
		div.innerHTML = `<p>${pcAction.init} - ${pcAction.name}: ${pcAction.action}</p>`;
	}
    console.log(turnDesc);
	document.getElementById(turnDesc.turnID).prepend(div);
});

socket.on('nextSecond', () => {
    // TODO: if want to have empty turn after move of contianer simply add specific to beginning of combat 1-5 and check for it
    const combatContainer = document.querySelector('.is-ancestor.is-warning');
    combatContainer.prepend(combatContainer.removeChild(combatContainer.getElementsByClassName('is-parent')[5]));
    combatContainer.getElementsByClassName('card')[0].classList.remove('is-hidden');
    combatContainer.getElementsByClassName('card-content')[1].classList.add('is-hidden');
});

socket.on('combatEnds', () => {
    document.querySelector('.tile.box').classList.remove('is-hidden');
	if (username === "DM") {
		document.getElementById("continue-combat").classList.add('is-hidden');
	} else {
		document.getElementById("to-landing").classList.remove('is-hidden');
	}
});