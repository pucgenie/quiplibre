"use strict";

const uebersetz = new Uebersetz('game_messages', uebersetz => {
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
	const fortsetzer = evt => {
		hintergrundmusik.play()
	}
	titelvideo.addEventListener('pause', fortsetzer)
	titelvideo.addEventListener('ended', fortsetzer)
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
	let r, g, b
	if(s == 0){
		r = g = b = l // achromatic
	}else{
		const hue2rgb = function hue2rgb(p, q, t){
			if(t < 0) t += 1
			if(t > 1) t -= 1
			if(t < 1/6) return p + (q - p) * 6 * t
			if(t < 1/2) return q
			if(t < 2/3) return p + (q - p) * (2/3 - t) * 6
			return p
		}
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s
		const p = 2 * l - q
		r = hue2rgb(p, q, h + 1/3)
		g = hue2rgb(p, q, h)
		b = hue2rgb(p, q, h - 1/3)
	}
	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function renderTotalPlayersText(playDiv) {
	__("TotalPlayers", {totalPlayerCount: players.length}, satz => playDiv.appendChild(textToNode(satz)))
}

class AbstractPlayer {
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
		
		let hslArr = hslToRgb(Math.random(), Math.random() * 0.5 + 0.5, 0.5)
		// pucgenie: cut-off negative channel values
		for(let i = hslArr.length; i --> 0; ) {
			if (hslArr[i] < 0) {
				hslArr[i] = 0
			}
		}
		// pucgenie: zu große Zahlen?
		//console.log(hslArr)
		hslArr = (hslArr[0] << 16) | (hslArr[1] << 8) | hslArr[2]
		this.color = '#' + hslArr.toString(16).padStart(6, '0')
		
		netPlayer.addEventListener('disconnect',    AbstractPlayer.prototype.disconnect.bind(this))
		netPlayer.addEventListener('receiveAnswer', AbstractPlayer.prototype.handleAnswer.bind(this))
		netPlayer.addEventListener('receiveChoice', AbstractPlayer.prototype.handleChoice.bind(this))
		netPlayer.addEventListener('userLang',      AbstractPlayer.prototype.handleUserLang.bind(this), {once: true})
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
			this.color = cmd.color
			this.netPlayer.sendCmd('updateName', {name: this.name, color: this.color})
			// pucgenie: why updateScore?
			this.netPlayer.sendCmd('updateScore', 0)
			this.state = "rest"
			this.displayMessage("GetReady")
			replaceContent(playDiv, playDiv => {
				__("LastPlayerJoined", undefined, satz => playDiv.appendChild(textToNode(satz)))
				const xB = document.createElement('b')
				xB.appendChild(document.createTextNode(cmd.answer))
				xB.style.color = this.color
				playDiv.appendChild(xB)
				playDiv.appendChild(document.createElement('br'))
				renderTotalPlayersText(playDiv)
			})
		break
		default:
			this.handleAnswer0(cmd)
		break
		}
	}
	handleChoice(cmd){
		//console.log(cmd)
		//console.log(this)
		if(cmd.promptId != this.promptId){//remember, == does not work on arrays
			console.log({"error": "ignoring choice as it's between incorrect options", "remotePromptId": cmd.promptId, "expectedPromptId": this.promptId})
			return
		}
		if(this.state != "choosing"){
			console.log("ignoring choice as player state is "+this.state)
			this.displayMessage("SuspectHacker")
	return
		}
		roundLogic.votes[cmd.index].push(this)
		if (round != maxRounds || ++this.voteCountR3 == maxRounds) {
			// WastedSpark(tm)
			this.voteCountR3 = 0
			this.state = "rest"
			this.displayMessage("YouVotedFor", {voteNumber: cmd.index+1})
			let stimmenSumme = 0
			for(let voteN of roundLogic.votes) {
				stimmenSumme += voteN.length
			}
			let voteFactor = round == maxRounds ? maxRounds : 1
			if(stimmenSumme >= players.length * voteFactor){
				if (stimmenSumme > players.length * voteFactor) {
					console.log("There are more votes than players!")
				}
				attrDiv.style.display = 'none'
				replaceContent(prevDiv, prevDiv => {
					__("PreviousResults", undefined, satz => prevDiv.appendChild(textToNode(satz)))
					
					roundLogic.awardPoints((xPlayer, xVotes) => {
						let xPDe = document.createElement('p')
						__("wonVotesPoints", {"Player": xPlayer, "Votes": xVotes}, xNeu => xPDe.appendChild(textToNode(xNeu)))
						prevDiv.appendChild(xPDe)
					})
					
					prevDiv.appendChild(document.createElement('br'))
				})
				progressJudgement()
			}
		}
	}
	handleUserLang(cmd){
		//console.log(cmd)
		this.userLang = cmd
		this.netPlayer.sendCmd('displayPrompt', {id: 0, prompt: undefined, lang: undefined, color: this.color, resPack: theResPack})
	}
}
AbstractPlayer.prototype.toString = function(){return this.name}

class QuiplibrePlayer extends AbstractPlayer {
	handleAnswer0(cmd) {
		// pucgenie: code reachable?
		console.log("in handleAnswer0")
		switch(this.state) {
		case "prompt0":
			if (cmd.promptId != this.promptId){
				this.displayMessage("WrongQuestion", {prompt: this.promptId, remotePrompt: cmd.promptId})
			}
			this.state = "prompt1"
			this.answers.push(cmd)
			this.promptId = this.prompts[1].id
			this.netPlayer.sendCmd('displayPrompt', this.prompts[1])
		break
		case "prompt1":
			if (cmd.promptId != this.promptId){
				this.displayMessage("WrongQuestion", {prompt: this.promptId, remotePrompt: cmd.promptId})
			}
			this.state = 'rest'
			this.answers.push(cmd.answer)
			this.displayMessage("PleaseWaitForOtherAnswers")
			if(roundLogic.allPlayersHaveAnswered()){
				progressJudgement()
			}
		break
		default:
			console.log({"playerName": this.name, "unexpectedState": this.state})
		break
		}
	}
}

class AbstractRound {
	constructor() {
		this.votes = undefined
		this.pp = undefined
		this.playerPairs = []
	}
	progressJudgement(funcAfter, outAnswer, outVoteOr){
		this.progressJudgement1()
		if (this.playerPairs.length == 0){
			nextRound()
	return
		}
		this.pp = this.playerPairs.splice(Math.floor(Math.random()*this.playerPairs.length), 1)[0]
		replaceContent(playDiv, playDiv => {
			const topP = document.createElement('p')
			topP.style["font-weight"] = "bold"
			topP.setAttribute('lang', resPackLang)
			topP.appendChild(document.createTextNode(this.pp.prompt.prompt))
			playDiv.appendChild(topP)
			
			let aI = 0
			let erstes = true
			for(let xPlayer of this.pp.players) {
				if (erstes) {
					erstes = false
				} else {
					outVoteOr()
				}
				outAnswer(xPlayer.answers[aI])
				if (round != maxRounds) {
					// pucgenie: how to refactor
					aI ^= 1
				}
			}
		})
		const choices = {
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
	awardPoints(perPlayer){
		for(let i = 0; i < this.votes.length; ++i){
			let xPlayer = this.pp.players[i]
			let xVotes = this.votes[i]
			xPlayer.score += xVotes.length * round
			xPlayer.netPlayer.sendCmd('updateScore', xPlayer.score)
			perPlayer(xPlayer, xVotes)
		}
	}
}

class Round_1_2 extends AbstractRound {
	nextRound1() {
		// pucgenie: players need to be initialized beforehand (reset questions and answers)
		allPlayers(p => {p.prompts = []; p.answers = []})
		
		// pucgenie: reduced one `if` of code and one global variable
		//use slice to copy array values, not a reference:
		let randomPlayers = players.slice()
		
		players.forEach((xPlayer, pIdx) => {
			const xPrompt = pullPrompt()
			
			// pucgenie: exclude this player itself, of course
			// pucgenie: don't create a new array, just move current player to one of the ends of the array.
			
			// pucgenie: unnecessarily swap one time and then don't need the condition :)
			//if (pIdx == 0) {
				randomPlayers[pIdx] = randomPlayers[0]
				randomPlayers[0] = xPlayer
			//}
			const xOpponent = randomPlayers.length > 1 ? randomPlayers.splice(Math.floor(Math.random()*(randomPlayers.length-2))+1, 1)[0] : randomPlayers[0]
			
			if (xPlayer == xOpponent) {
				console.log('crap')
			}
			
			const ppair = {players: [xPlayer, xOpponent], prompt: xPrompt}
			this.playerPairs.push(ppair)
			xPlayer.prompts[0] = xPrompt
			xOpponent.prompts[1] = xPrompt
		})
	}
	progressJudgement1() {
		this.votes = [[],[]]
	}
	getAllAnswers() {
		return [this.pp.players[0].answers[0], this.pp.players[1].answers[1]]
	}
	allPlayersHaveAnswered(){
		return allPlayers(p => p.answers.length==2)
	}
}

class Round_3 extends AbstractRound {
	nextRound1() {
		const xPrompts = [pullPrompt()]
		let ppair = {players: players, prompt: xPrompts[0]}
		this.playerPairs.push(ppair)
		for (let xPlayer of players) { //todo: could refactor this to use allPlayers
			xPlayer.prompts = xPrompts
			xPlayer.answers = new Array(1)
		}
	}
	progressJudgement1() {
		this.votes = new Array(players.length)
		for(let i = players.length; i --> 0; ) {
			this.votes[i] = []
		}
	}
	getAllAnswers() {
		let ret = new Array(this.pp.players.length)
		for(let xPlayer of this.pp.players) {
			ret.push(xPlayer.answers[0])
		}
		return ret
	}
	allPlayersHaveAnswered(){
		return allPlayers(p => p.answers.length==1)
	}
}

const happyfuntimes = require('happyfuntimes')

const server = new happyfuntimes.GameServer()

const theResPack = 'Quiplash/content/QuiplashQuestion'
const resPackLang = 'en'
const maxRounds = 3 //a nice number of rounds
let prompts
lazyLoad(`${theResPack}.jet`, rText => {
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
let gameBegun = false
const players = []
let round = 0
let roundLogic = undefined

/**
 * A new player has arrived.
**/
server.on('playerconnect', netPlayer => {
	// pucgenie: why does one player connect 2 times? (2019-05-05) --> __() called callback multiple times.
	//console.log(netPlayer)
	if (gameBegun){
		netPlayer.sendCmd('displayMessage', {template: "CantJoinRunningGame"})
return
	}
	const tmpPlayerName = []
	__("Player", {playerNum: players.length+1}, Array.prototype.push.bind(tmpPlayerName))
	players.push(new QuiplibrePlayer(netPlayer, tmpPlayerName.join('')))
})

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
	roundLogic = round == maxRounds ? new Round_3() : new Round_1_2()
	roundLogic.nextRound1()
	for (let xPlayer of players) {
		xPlayer.netPlayer.sendCmd('displayPrompt', xPlayer.prompts[0])
		xPlayer.state = round == maxRounds ? "prompt1" : "prompt0"
		xPlayer.promptId = xPlayer.prompts[0].id
	}
	replaceContentTranslated(playDiv, "RoundBanner", {roundNum: round})
	buttonDiv.style.display = 'none'
}

function progressJudgement(){
	let voteOr = []
	__("VoteOr", undefined, Array.prototype.push.bind(voteOr))
	voteOr = voteOr.join('')
	
	roundLogic.progressJudgement(choices => {
		try {
			const pfad1 = 'Quiplash/content/QuiplashQuestion/' + choices.prompt.id
			lazyLoad(pfad1 + '/data.jet', rText => {
				// pucgenie: Announce the question text.
				let questionRead = new Audio(pfad1 + "/" + JSON.parse(rText)['fields'].filter(feld => feld['n'] == "PromptAudio")[0]['v'] + ".mp3")
				questionRead.addEventListener('ended', () => {
					let sepMsgT = {lang: undefined, text: undefined}
					{
						const ausG = []
						sepMsgT.lang = __('VoteOr', undefined, xTxt2 => ausG.push(xTxt2))
						sepMsgT.text = ausG.join('')
					}
					hintergrundmusik.pause()
					let prevMsg = undefined
					for(let xP of document.querySelectorAll('#playDiv .answer')) {
						let msg = new SpeechSynthesisUtterance()
						msg.text = xP.innerText
						msg.lang = xP.getAttribute('lang')
						if (!prevMsg) {
							window.speechSynthesis.speak(msg)
					continue
						}
						prevMsg.addEventListener('end', () => {
							let sepMsg = new SpeechSynthesisUtterance()
							Object.assign(sepMsg, sepMsgT)
							sepMsg.addEventListener('end', () => window.speechSynthesis.speak(msg), {once: true})
							window.speechSynthesis.speak(sepMsg)
						})
						prevMsg = msg
					}
					prevMsg.addEventListener('end', () => hintergrundmusik.play())
				})
				questionRead.play()
			})
		} catch (soundExc) {
			console.log({"nonFatalException": soundExc})
		}
	}, outAnswer => {
		const xPAnswer = document.createElement('p')
		xPAnswer.classList.add('answer')
		xPAnswer.setAttribute('lang', outAnswer.lang)
		xPAnswer.appendChild(document.createTextNode(outAnswer.answer))
		playDiv.appendChild(xPAnswer)
	}, () => {
		const xNode = document.createElement('p')
		xNode.classList.add('answer')
		xNode.setAttribute('lang', uebersetz.languages)
		xNode.appendChild(textToNode(voteOr))
		playDiv.appendChild(xNode)
	})
}

function endGame(){
	sortPlayers()
	replaceContent(playDiv, playDiv => {
		playDiv.appendChild(replaceContentTranslated(document.createElement('p'), "GameEndedScore"))
		const xTbody = document.createElement('tbody')
		players.forEach(p => {
			const xTr = document.createElement('tr')
			new Array(p.name, p.score).forEach(xTxt => {
				let xTd = document.createElement('td')
				xTd.appendChild(textToNode(xTxt))
				xTr.appendChild(xTd)
			})
			xTbody.appendChild(xTr)
		})
		const xTable = document.createElement('table')
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
	// Now it is possible for players to leave and join before nextRound() is called (e.g. by tapping on a button).
	buttonDiv.style.display = 'block'
}

//helper & utility fns
function display(html){playDiv.innerHTML = html}

function pullPrompt(){
	if (prompts.length == 0){
		return {prompt: "What's a good prompt for a round of Quiplibre?"+
			" (Please send us the winning answer of this round, "+
			"as you have exhausted our list of prompts)", id: 1}
	}
	return prompts.splice(Math.floor(Math.random()*prompts.length), 1)[0]
}

function allPlayers(pred){ //query all players or apply a fn to them
	let ret = true
	for (let xPlayer of players) {
		ret = (pred(xPlayer)) && ret //must avoid short-circuit eval
	}
	return ret
}

function sortPlayers(){//descending. In-place and returns arr
	return players.sort((a, b) => (b.score - a.score))
}
