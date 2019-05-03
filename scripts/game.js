
const uebersetz = new Uebersetz('game_messages.json', uebersetz => {
	window.__ = (key, basis, func, joined) => uebersetz.__(uebersetz.languages, key, basis, func, joined)
	if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
		document.addEventListener('DOMContentLoaded', nachDemLaden, {once: true})
	} else {
		nachDemLaden()
	}
})

function nachDemLaden() {
	document.querySelectorAll('[data-tlk]').forEach(elem => {
		replaceContentTranslated(elem, elem.getAttribute('data-tlk'))
		//elem.removeAttribute('data-tlk')
	})
	
	titelvideo.addEventListener('play', evt => {
		hintergrundmusik.pause()
	})
	var fortsetzer = evt => {
		hintergrundmusik.play()
	}
	titelvideo.addEventListener('pause', fortsetzer)
	titelvideo.addEventListener('ended', fortsetzer)
}

function randInt(min, max) {
	if (max === undefined) {
		max = min
		min = 0
	}
	return Math.random() * (max - min) + min | 0
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 * @source https://stackoverflow.com/a/9493060
 */
function hslToRgb(h, s, l){
	var r, g, b
	if(s == 0){
		r = g = b = l // achromatic
	}else{
		var hue2rgb = function hue2rgb(p, q, t){
			if(t < 0) t += 1
			if(t > 1) t -= 1
			if(t < 1/6) return p + (q - p) * 6 * t
			if(t < 1/2) return q
			if(t < 2/3) return p + (q - p) * (2/3 - t) * 6
			return p
		}
		var q = l < 0.5 ? l * (1 + s) : l + s - l * s
		var p = 2 * l - q
		r = hue2rgb(p, q, h + 1/3)
		g = hue2rgb(p, q, h)
		b = hue2rgb(p, q, h - 1/3)
	}
	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function renderTotalPlayersText(playDiv) {
	__("TotalPlayers", {totalPlayerCount: players.length}, satz => playDiv.appendChild(textToNode(satz)))
}

class Player {
	constructor(netPlayer, name) {
		this.netPlayer = netPlayer
		this.name = name
		this.state = "nameless"
		this.prompts = []
		this.promptId = 0
		this.answers = []
		this.score = 0
		this.userLang = ["en"]
		this.voteCountR3 = 0
		
		var hslArr = hslToRgb(randInt(360), randInt(2) * 50 + 50, 50)
		// pucgenie: cut-off negative channel values
		for(var i = hslArr.length; i --> 0; ) {
			if (hslArr[i] < 0) {
				hslArr[i] = 0
			}
		}
		hslArr = (hslArr[0] << 16) | (hslArr[1] << 8) | hslArr[2]
		this.color = '#' + hslArr.toString(16).padStart(6, '0')
		
		netPlayer.addEventListener('disconnect', Player.prototype.disconnect.bind(this))
		netPlayer.addEventListener('receiveAnswer', Player.prototype.handleAnswer.bind(this))
		netPlayer.addEventListener('receiveChoice', Player.prototype.handleChoice.bind(this))
		netPlayer.addEventListener('userLang', Player.prototype.handleUserLang.bind(this))
	}

	disconnect() {
		const ndx = players.indexOf(this)
		if (ndx >= 0) {
			players.splice(ndx, 1)
		} else {
			console.log({"notfound": this})
		}
		clearElementChilds(playDiv)
		renderTotalPlayersText(playDiv)
	}
	/**
	 * A wrapper for sendCmd('displayMessage', ...) without obvious reflection semantics etc..
	**/
	displayMessage(template, params){
		this.netPlayer.sendCmd('displayMessage', {template: template, params: params})
	}
	handleAnswer(cmd){
		//the idea is to check if the response is to the right question
		//to prevent errors
		//console.log(this);
		//console.log({"promptId":cmd.promptId, "answer":cmd.answer});
		if(cmd.answer==""){
			this.displayMessage("ignoringEmptyCmdAnswer")
	return
		}
		switch (this.state) {
		case "rest":
			this.displayMessage("RestStateSoNoAction")
		break
		case "nameless":
			if (cmd.promptId != 0) {
				this.displayMessage("NamelessUnexpectedPrompt", {promptId: cmd.promptId})
	return
			}
			this.name = cmd.answer
			this.netPlayer.sendCmd('updateName', {name: this.name, color: this.color})
			// pucgenie: why updateScore?
			this.netPlayer.sendCmd('updateScore', 0)
			this.state = "rest"
			this.displayMessage("GetReady")
			replaceContent(playDiv, playDiv => {
				__("LastPlayerJoined", undefined, satz => playDiv.appendChild(textToNode(satz)))
				var xB = document.createElement('b')
				xB.appendChild(document.createTextNode(cmd.answer))
				xB.style.color = this.color
				playDiv.appendChild(xB)
				playDiv.appendChild(document.createElement('br'))
				renderTotalPlayersText(playDiv)
			})
		break
		case "prompt0":
			if (cmd.promptId != this.promptId){
				this.displayMessage("WrongQuestion", {prompt: this.promptId, remotePrompt: cmd.promptId})
			}
			this.state = "prompt1"
			this.answers.push(cmd.answer)
			this.promptId = this.prompts[1].id
			this.netPlayer.sendCmd('displayPrompt', this.prompts[1])
		break;
		case "prompt1":
			if (cmd.promptId != this.promptId){
				this.displayMessage("WrongQuestion", {prompt: this.promptId, remotePrompt: cmd.promptId})
			}
			this.state = 'rest'
			this.answers.push(cmd.answer)
			this.displayMessage("PleaseWaitForOtherAnswers")
			if(allPlayersHaveAnswered()){
				progressJudgement();
			}
		break;
		default:
			console.log({"playerName": this.name, "unexpectedState": this.state})
		break;
		}
	}
	handleChoice(cmd){
		console.log(cmd)
		console.log(this)
		if(cmd.promptId != this.promptId){//remember, == does not work on arrays
			console.log({"error": "ignoring choice as it's between incorrect options", "remotePromptId": cmd.promptId, "expectedPromptId": this.promptId})
			return
		}
		if(this.state != "choosing"){
			console.log("ignoring choice as player state is "+this.state);
			this.displayMessage("SuspectHacker")
	return
		}
		roundLogic.votes[cmd.index].push(this)
		if (round != 3 || ++this.voteCountR3 == 3) {
			// WastedSpark(tm)
			this.voteCountR3 = 0
			this.state = "rest"
			this.displayMessage("YouVotedFor", {voteNumber: cmd.index+1})
			var stimmenSumme = 0
			for(var voteN of roundLogic.votes) {
				stimmenSumme += voteN.length
			}
			var voteFactor = round == 3 ? 3 : 1
			if(stimmenSumme >= players.length * voteFactor){
				if (stimmenSumme > players.length * voteFactor) {
					console.log("There are more votes than players!")
				}
				awardPoints()
				progressJudgement()
			}
		}
	}
	handleUserLang(cmd){
		this.userLang = uebersetz.filterAvailableLanguages(cmd.languages)
		var specialTrnsltd = {id: 0, prompt: undefined, lang: undefined, color: this.color}
		specialTrnsltd.lang = uebersetz.__(this.userLang, "WhatsYourName", undefined, satz => specialTrnsltd.prompt = satz)
		this.netPlayer.sendCmd('displayPrompt', specialTrnsltd)
	}
}
Player.prototype.toString = function(){return this.name}

class AbstractRound {
	constructor() {
		this.votes = undefined
		this.pp = undefined
		this.playerPairs = []
	}
	progressJudgement(funcAfter){
		this.progressJudgement1()
		if (this.playerPairs.length == 0){
			nextRound()
	return
		}
		this.pp = this.playerPairs.splice(Math.floor(Math.random()*this.playerPairs.length), 1)[0]
		replaceContent(playDiv, playDiv => {
			var topP = document.createElement('p')
			topP.style["font-weight"] = "bold"
			topP.appendChild(document.createTextNode(this.pp.prompt.prompt))
			playDiv.appendChild(topP)
			
			var aI = 0
			var erstes = true
			for(var xPlayer of this.pp.players) {
				if (erstes) {
					erstes = false
				} else {
					var xNode = document.createElement('p')
					xNode.classList.add('answer')
					xNode.setAttribute('lang', uebersetz.languages)
					__("VoteOr", undefined, satz => xNode.appendChild(textToNode(satz)))
					playDiv.appendChild(xNode)
					playDiv.appendChild(document.createElement('br'))
				}
				var xPAnswer = document.createElement('p')
				xPAnswer.classList.add('answer')
				xPAnswer.setAttribute('lang', xPlayer.answers[aI].lang)
				xPAnswer.appendChild(document.createTextNode(xPlayer.answers[aI]))
				playDiv.appendChild(xPAnswer)
				if (round != 3) {
					// pucgenie: how to refactor
					aI ^= 1
				}
			}
		})
		var choices = {
			"possibilities": this.getAllAnswers(),
			"prompt": this.pp.prompt
		}
		allPlayers(p => {
			p.netPlayer.sendCmd("displayChoice", choices)
			p.state = "choosing"
			p.promptId = choices.prompt.id
		})
		funcAfter(choices)
	}
}

class Round_1_2 extends AbstractRound {
	nextRound1() {
		for (var xPlayer of players) { //todo: could refactor this to use allPlayers
			var xPrompt = pullPrompt()
			var xOpponent = pullRandomPlayer(xPlayer)
			var ppair = {players: [xPlayer, xOpponent], prompt: xPrompt}
			this.playerPairs.push(ppair)
			xPlayer.prompts[0] = xPrompt
			xOpponent.prompts[1] = xPrompt
		}
	}
	progressJudgement1() {
		this.votes = [[],[]]
	}
	getAllAnswers() {
		return [this.pp.players[0].answers[0], this.pp.players[1].answers[1]]
	}
}

class Round_3 extends AbstractRound {
	nextRound1() {
		var xPrompt = pullPrompt()
		var ppair = {players: players, prompt: xPrompt}
		this.playerPairs.push(ppair)
		for (var xPlayer of players) { //todo: could refactor this to use allPlayers
			xPlayer.prompts[0] = xPrompt
		}
	}
	progressJudgement1() {
		// pucgenie: experimental
		this.votes = new Array(players.length)
		for(var i = players.length; i --> 0; ) {
			this.votes[i] = []
		}
	}
	getAllAnswers() {
		var ret = []
		for(var xPlayer of this.pp.players) {
			ret.push(xPlayer.answers[0])
		}
		return ret
	}
}

const happyfuntimes = require('happyfuntimes')

const server = new happyfuntimes.GameServer()

var prompts
lazyLoad('Quiplash/content/QuiplashQuestion.jet', rText => {
	prompts = JSON.parse(rText)['content']
	/*
	// temporary converter
	var xPre = document.createElement('pre')
	for(var xP of prompts) {
		xPre.appendChild(document.createTextNode(`"${xP.id}": "${xP.prompt}",
`))
	}
	playDiv.appendChild(xPre)
	*/
})

// A new player has arrived.
server.on('playerconnect', netPlayer => {
	if (gameBegun){
		netPlayer.sendCmd('displayMessage', {template: "CantJoinRunningGame"})
		return
	}
	// pucgenie: possible race condition? No, JavaScript is single-threaded by default.
	__("Player", {playerNum: players.length+1}, playerText => {
		players.push(new Player(netPlayer, playerText))
	})
})

// globals
var gameBegun = false
const players = []
var round = 0
var roundLogic = undefined
const maxRounds = 3 //a nice number of rounds

function getRoundLogic(roundNum) {
	allPlayers(p => {p.prompts = []; p.answers = []})
	switch (roundNum) {
		case 1:
		case 2:
			return new Round_1_2()
		case 3:
			return new Round_3()
	}
}

//game logic fns
function nextRound(){
	if (players.length <= 1){
		replaceContentTranslated(playDiv, "NeedMorePlayers")
return
	}
	titelvideo.pause()
	titelvideo.style['display'] = 'none'
	//clearElementChilds(playDiv)
	gameBegun = true
	if (++round > maxRounds){
		endGame()
return
	}
	roundLogic = getRoundLogic(round)
	roundLogic.nextRound1()
	for (var xPlayer of players) {
		xPlayer.netPlayer.sendCmd('displayPrompt', xPlayer.prompts[0])
		xPlayer.state = round == 3 ? "prompt1" : "prompt0"
		xPlayer.promptId = xPlayer.prompts[0].id
	}
	replaceContentTranslated(playDiv, "RoundBanner", {roundNum: round})
	buttonDiv.style.display = 'none'
}

function progressJudgement(){
	roundLogic.progressJudgement(choices => {
		try {
			var pfad1 = 'Quiplash/content/QuiplashQuestion/' + choices.prompt.id
			lazyLoad(pfad1 + '/data.jet', rText => {
				// pucgenie: Announce the question text.
				var questionRead = new Audio(pfad1 + "/" + JSON.parse(rText)['fields'].filter(feld => feld['n'] == "PromptAudio")[0]['v'] + ".mp3")
				questionRead.addEventListener('ended', () => {
					var ausG = []
					var slg = __('VoteOr', undefined, xTxt2 => ausG.push(xTxt2))
					var sepMsg = new SpeechSynthesisUtterance(ausG[0])
					sepMsg.lang = slg
					hintergrundmusik.pause()
					var prevMsg = undefined
					for(var xP of document.querySelectorAll('#playDiv .answer')) {
						var msg = new SpeechSynthesisUtterance(xP.innerText)
						msg.lang = xP.getAttribute('lang')
						if (prevMsg) {
							prevMsg.addEventListener('end', () => {
								sepMsg.addEventListener('end', () => {
									window.speechSynthesis.speak(msg)
								}, {once: true})
								window.speechSynthesis.speak(sepMsg)
							})
						} else {
							window.speechSynthesis.speak(msg)
						}
						prevMsg = msg
					}
					prevMsg.addEventListener('end', () => {
						hintergrundmusik.play()
					})
				})
				questionRead.play()
			})
		} catch (soundExc) {
			console.log({"nonFatalException": soundExc})
		}
	})
}

function awardPoints(){
	attrDiv.style.display = 'none'
	prevDiv.style.display = 'none'
	clearElementChilds(prevDiv)
	__("PreviousResults", undefined, satz => prevDiv.appendChild(textToNode(satz)))
	
	for(var i = 0; i < roundLogic.votes.length; ++i){
		var xPlayer = roundLogic.pp.player[i]
		var xVotes = roundLogic.votes[i]
		xPlayer.score += xVotes.length * round
		xPlayer.netPlayer.sendCmd("updateScore", xPlayer.score)
		__("wonVotesPoints", {"Player": xPlayer, "Votes": xVotes}, xNeu => prevDiv.appendChild(textToNode(xNeu)))
	}
	prevDiv.appendChild(document.createElement('br'))
	prevDiv.style.display = 'block'
}

function endGame(){
	sortPlayers()
	replaceContent(playDiv, playDiv => {
		playDiv.appendChild(replaceContentTranslated(document.createElement('p'), "GameEndedScore"))
		var xTbody = document.createElement('tbody')
		players.forEach(p => {
			var xTr = document.createElement('tr')
			new Array(p.name, p.score).forEach(xTxt => {
				var xTd = document.createElement('td')
				xTd.appendChild(textToNode(xTxt))
				xTr.appendChild(xTd)
			})
			xTbody.appendChild(xTr)
		})
		var xTable = document.createElement('table')
		xTable.classList.add('scoreboard')
		xTable.appendChild(xTbody)
		playDiv.appendChild(xTable)
	})
	gameCtrlDiv.style.display = 'block'
	attrDiv.style.display = 'block'
	//todo: could send something to players
	players.forEach(xPlayer => xPlayer.displayMessage("GameEnded"))
	titelvideo.style['display'] = 'block'
}

function newGame(){
	gameCtrlDiv.style.display = 'none'
	replaceContentTranslated(prevDiv, "PreviousWinner", {Player: players[0]})
	round = 0
	allPlayers(p => {
		p.score = 0
		p.netPlayer.sendCmd('updateScore', 0)
	})
	// pucgenie: disabled exceptional line of code.
	//nextRound()
	buttonDiv.style.display = 'block'
}

//helper & utility fns
function display(html){playDiv.innerHTML = html}

function pullPrompt(){
	if (prompts.length == 0){
		return {prompt: "What's a good prompt for a round of Quiplibre?"+
			" (Please send us the winning answer of this round, "+
			"as you have exhausted our list of prompts)", id: 0}
	}
	return prompts.splice(Math.floor(Math.random()*prompts.length), 1)[0]
}

var randomPlayers = []
function pullRandomPlayer(excludedPlayer){
	//remember that excludedPlayer is just a reference to a player
	//use slice to copy array values, not a reference:
	if (randomPlayers.length == 0){
		randomPlayers = players.slice()
	}
	tmpPlayers = randomPlayers.filter(p => (p != excludedPlayer))
	var i = Math.floor(Math.random()*(randomPlayers.length-1))
	randomPlayers = randomPlayers.filter(p => (p != tmpPlayers[i]))
	return tmpPlayers[i]
}

function allPlayers(pred){ //query all players or apply a fn to them
	ret = true
	for (var xPlayer of players) {
		ret = (pred(xPlayer)) && ret //must avoid short-circuit eval
	}
	return ret
}

function allPlayersHaveAnswered(){
	return allPlayers(p => p.answers.length==2)
}

function sortPlayers(){//descending. In-place and returns arr
	return players.sort((a, b) => (b.score - a.score))
}
