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
	if(window.secretHintergrundmusik){
		hintergrundmusik.setAttribute('src', window.secretHintergrundmusik)
		const fortsetzer = evt => {
			hintergrundmusik.play()
		}
		fortsetzer()
		if(window.secretTitelvideo){
			titelvideo.setAttribute('src', window.secretTitelvideo)
			titelvideo.addEventListener('play', evt => {
				hintergrundmusik.pause()
			})
			titelvideo.addEventListener('pause', fortsetzer)
			titelvideo.addEventListener('ended', fortsetzer)
		}
	}
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
	constructor(xnetPlayer, name) {
		// pucgenie: never ever cache netplayer anywhere else. It may change during one game round.
		this.netPlayer = xnetPlayer
		this.name = name
		this.state = 'nameless'
		this.previousState = undefined
		this.prompts = []
		this.promptId = 0
		this.answers = []
		this.score = 0
		this.userLang = ["en"]
		this.voteCountR3 = 0
		this.connected = true
		
		let hslArr = hslToRgb(Math.random(), Math.random() * 0.5 + 0.5, 0.5)
		// pucgenie: cut-off negative channel values
		for(let i = hslArr.length; i --> 0; ) {
			if (hslArr[i] < 0) {
				console.log('color generator flaw')
				hslArr[i] = 0
			}
		}
		hslArr = (hslArr[0] << 16) | (hslArr[1] << 8) | hslArr[2]
		this.color = '#' + hslArr.toString(16).padStart(6, '0')
		
		this.stateMap = {
			'rest': cmd => this.displayMessage("RestStateSoNoAction"),
			'nameless': cmd => {
				if (cmd.promptId != 0) {
					this.displayMessage("NamelessUnexpectedPrompt", {promptId: cmd.promptId})
		throw `Ignored player ${cmd.answer}`
				}
				this.name = cmd.answer
				this.color = cmd.color
				// pucgenie: exceptional behaviour, thus not registered in syncCurrentStatus()
				this.netPlayer.sendCmd('updateName', {name: this.name, color: this.color})
				let xPlayer
				if (gameBegun){
					// pucgenie: the first player that reconnects using the name of a disconnected player "hijacks" that player's profile.
					xPlayer = players.find(xPlayer => (!xPlayer.connected) && xPlayer.name === cmd.answer)
					if(!xPlayer){
						this.displayMessage("CantJoinRunningGame")
		throw `Ignored wrongly connecting player ${cmd.answer}`
					}
					// pucgenie: "this" changes. Event handlers are using arrow functions so we have to deregister the old ones and create new ones.
					xPlayer.unregisterEventHandlers()
					newPlayers.splice(newPlayers.indexOf(this), 1)
					// pucgenie: retains old xPlayer's state so we can resynchronize
					xPlayer.netPlayer = this.netPlayer
					xPlayer.connected = true
					xPlayer.registerEventHandlers()
				} else {
					xPlayer = this
					newPlayers.splice(newPlayers.indexOf(this), 1)
					players.push(this)
					
					this.stateStep("rest")
					this.displayMessage("GetReady")
					replaceContent(playDiv, playDiv => {
						__("LastPlayerJoined", undefined, satz => playDiv.appendChild(textToNode(satz)))
						const xB = document.createElement('b')
						xB.appendChild(document.createTextNode(cmd.answer))
						xB.style['color'] = this.color
						playDiv.appendChild(xB)
						playDiv.appendChild(document.createElement('br'))
						renderTotalPlayersText(playDiv)
					})
				}
			}
		}
		
		this.syncMap = {
			'nameless': () => {
				this.netPlayer.sendCmd('updateScore', this.score)
			}
		}
		
		this.evtDisconnect = () => {
			let ndx = newPlayers.indexOf(this)
			if (ndx >= 0){
				newPlayers.splice(ndx, 1)
		return
			}
			ndx = players.indexOf(this)
			if (ndx >= 0) {
				if(gameBegun){
					// pucgenie: keep player for reconnect
					this.connected = false
				} else {
					players.splice(ndx, 1)
				}
			} else {
				console.log({"notfound": this})
			}
			clearElementChilds(playDiv)
			renderTotalPlayersText(playDiv)
		}
		
		this.evtReceiveAnswer = cmd => {
			//the idea is to check if the response is to the right question
			//to prevent errors
			//console.log(this);
			//console.log({"promptId":cmd.promptId, "answer":cmd.answer});
			if(cmd.answer==""){
				this.displayMessage("ignoringEmptyCmdAnswer")
		return
			}
			const xFn = this.stateMap[this.state]
			if(!xFn){
				console.log({"playerName": this.name, "unexpectedState": this.state, "previousState": this.previousState})
		return
			}
			try {
				xFn(cmd)
			} catch (e) {
				// pucgenie: check if it really is 'WrongQuestion' etc.
				console.log(e)
			}
			this.syncCurrentStatus()
		}
		
		this.evtReceiveChoice = cmd => {
			//console.log(cmd)
			//console.log(this)
			if(cmd.promptId != this.promptId){//remember, == does not work on arrays
				console.log({"error": "ignoring choice as it's between incorrect options", "remotePromptId": cmd.promptId, "expectedPromptId": this.promptId})
				return
			}
			if(this.state !== 'choosing'){
				console.log("ignoring choice as player state is "+this.state)
				this.displayMessage("SuspectHacker")
		return
			}
			roundLogic.votes[cmd.index].push(this)
			if (round != maxRounds || ++this.voteCountR3 == maxRounds) {
				// WastedSpark(tm)
				this.voteCountR3 = 0
				this.stateStep('rest')
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
					attrDiv.style['display'] = 'none'
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
		
		this.registerEventHandlers()
	}
	stateStep(nextState){
		this.previousState = this.state
		this.state = nextState
	}
	registerEventHandlers(){
		this.netPlayer.addEventListener('disconnect', this.evtDisconnect)
		this.netPlayer.addEventListener('receiveAnswer', this.evtReceiveAnswer)
		this.netPlayer.addEventListener('receiveChoice', this.evtReceiveChoice)
		
		this.netPlayer.addEventListener('userLang', cmd => {
			//console.log(cmd)
			this.userLang = cmd
			this.netPlayer.sendCmd('displayPrompt', {id: 0, prompt: undefined, lang: undefined, color: this.color, resPack: window.theResPack})
		}, {once: true})
	}
	unregisterEventHandlers(){
		if(!this.evtDisconnect){
			throw "Invalid state: no listeners registered before!"
		}
		this.netPlayer.removeEventListener('disconnect', this.evtDisconnect)
		this.netPlayer.removeEventListener('receiveAnswer', this.evtReceiveAnswer)
		this.netPlayer.removeEventListener('receiveChoice', this.evtReceiveChoice)
	}
	syncCurrentStatus(){
		const xFn2 = this.syncMap[this.previousState]
		if(xFn2){
			xFn2()
		} else {
			console.log(`No syncMap entry for previousState: ${this.previousState}`)
		}
	}
	/**
	 * A wrapper for sendCmd('displayMessage', ...) without obvious reflection semantics etc..
	**/
	displayMessage(template, params){
		this.netPlayer.sendCmd('displayMessage', {template: template, params: params})
	}
}
AbstractPlayer.prototype.toString = function(){return this.name}

/**
 * Player events related to Quiplibre Textmode
**/
class QuiplibrePlayer extends AbstractPlayer {
	constructor(xnetPlayer, name){
		super(xnetPlayer, name)
		this.stateMap['prompt0'] = cmd => {
			if (cmd.promptId != this.promptId){
				this.displayMessage("WrongQuestion", {prompt: this.promptId, remotePrompt: cmd.promptId})
			}
			this.stateStep('prompt1')
			this.answers.push(cmd)
			this.promptId = this.prompts[1].id
		}
		this.syncMap['prompt0'] = () => this.netPlayer.sendCmd('displayPrompt', this.prompts[1])
		this.stateMap['prompt1'] = cmd => {
			if (cmd.promptId != this.promptId){
				this.displayMessage("WrongQuestion", {prompt: this.promptId, remotePrompt: cmd.promptId})
			throw "WrongQuestion"
			}
			this.stateStep('rest')
			this.answers.push(cmd.answer)
		}
		this.syncMap['prompt1'] = () => {
			this.displayMessage("PleaseWaitForOtherAnswers")
			if(roundLogic.allPlayersHaveAnswered()){
				progressJudgement()
			}
		}
	}
}

class AbstractRound {
	constructor() {
		this.votes = undefined
		this.pp = undefined
		this.playerPairs = []
	}
	static pullPrompt(){
		if (window.prompts.length == 0){
			return {prompt: "What's a good prompt for a round of Quiplibre?"+
				" (Please send us the winning answer of this round, "+
				"as you have exhausted our list of prompts)", id: 1}
		}
		return window.prompts.splice(Math.floor(Math.random()*window.prompts.length), 1)[0]
	}
	progressJudgement(showVotingOptions_pp, func_choices){
		this.progressJudgement1()
		if (this.playerPairs.length == 0){
			nextRound()
	return
		}
		this.pp = this.playerPairs.splice(Math.floor(Math.random()*this.playerPairs.length), 1)[0]
		showVotingOptions_pp(this.pp)
		const choices = {
			"possibilities": this.getAllAnswers(),
			"prompt": this.pp.prompt
		}
		allPlayers(p => {
			p.netPlayer.sendCmd("displayChoice", choices)
			p.stateStep("choosing")
			p.promptId = choices.prompt.id
		})
		func_choices(choices)
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

/**
 * Shuffles array in place.
 * https://stackoverflow.com/a/6274381
 * https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
    let j, x
    for (let i = a.length; i --> 0;) {
        j = Math.floor(Math.random() * (i + 1))
        x = a[i]
        a[i] = a[j]
        a[j] = x
    }
    return a
}

class Round_1_2 extends AbstractRound {
	nextRound1() {
		// pucgenie: parallelizable, if ECMAScript would support it - but pullPrompt would be the bottleneck, I think
		players.forEach(p => {
			p.prompts = [AbstractRound.pullPrompt(), undefined]
			p.answers = new Array(2) //optimization+readability
			this.playerPairs.push({players: [p, undefined], prompt: p.prompts[0]})
		})
		// pucgenie: shuffle players so that the matchmaking is less complex
		
		//use slice to copy array values, not a reference:
		const randomPlayers = players.slice()
		this.playerPairs.forEach(xPp => {
			let xRP = Math.floor(Math.random() * (randomPlayers.length-1))
			if(randomPlayers[xRP] === xPp.players[0]){
				// pucgenie: cheap, isn't it?
				++xRP
			}
			let xP = randomPlayers[xRP]
			if(this.playerPairs.filter(pp => pp.players[0] === xP && pp.players[1] === xPp.players[0]).length == 1){
				// pucgenie: find another player for this pair...
			}
			//console.log(randomPlayers.map(p => p.name), xRP, this.playerPairs)
			randomPlayers.splice(xRP, 1)[0]
			xP.prompts[1] = xPp.prompt
			xPp.players[1] = xP
			// pucgenie: already set in first loop
			//xPp.players[0].prompts[0] = xPp.prompt
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
		const xPrompts = [AbstractRound.pullPrompt()]
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

const maxRounds = 3 //a nice number of rounds

if(window.theResPack){
	lazyLoad(`${window.theResPack}.jet`, rText => {
		window.prompts = JSON.parse(rText)['content']
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
}
let   gameBegun  = false
const players    = []
const newPlayers = new Array(3)
let   round      = 0
let   roundLogic = undefined

/**
 * A new player has arrived.
**/
server.on('playerconnect', netPlayer => {
	// pucgenie: why does one player connect 2 times? (2019-05-05) --> __() called callback multiple times.
	//console.log(netPlayer)
	const tmpPlayerName = []
	__("Player", {playerNum: players.length+1}, Array.prototype.push.bind(tmpPlayerName))
	newPlayers.push(new QuiplibrePlayer(netPlayer, tmpPlayerName.join('')))
})

function nextRound(){
	if (players.length <= 1){
		replaceContentTranslated(playDiv, "NeedMorePlayers")
return
	}
	buttonDiv.style['display']  = 'none'
	titelvideo.pause()
	titelvideo.style['display'] = 'none'
	//clearElementChilds(playDiv)
	gameBegun = true
	if (++round > maxRounds){
		sortPlayers()
		replaceContent(playDiv, playDiv => {
			playDiv.appendChild(replaceContentTranslated(document.createElement('p'), "GameEndedScore"))
			const xTbody = document.createElement('tbody')
			players.forEach(p => {
				const xTr = document.createElement('tr')
				new Array(p.name, p.score).forEach(xTxt => {
					const xTd = document.createElement('td')
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
		gameCtrlDiv.style['display'] = 'block'
		attrDiv.style['display']     = 'block'
		titelvideo.style['display']  = 'block'
		players.forEach(xPlayer => xPlayer.displayMessage("GameEnded"))
		// pucgenie: allows new players to join
		gameBegun = false
		// pucgenie: garbage
		roundLogic = undefined
return
	}
	roundLogic = round < maxRounds ? new Round_1_2() : new Round_3()
	roundLogic.nextRound1()
	for (let xPlayer of players) {
		xPlayer.stateStep(round == maxRounds ? 'prompt1' : 'prompt0')
		xPlayer.promptId = xPlayer.prompts[0].id
		xPlayer.netPlayer.sendCmd('displayPrompt', xPlayer.prompts[0])
	}
	replaceContentTranslated(playDiv, "RoundBanner", {roundNum: round})
}

function progressJudgement(){
	let voteOr = []
	__("VoteOr", undefined, Array.prototype.push.bind(voteOr))
	voteOr = voteOr.join('')
	
	roundLogic.progressJudgement(pp => replaceContent(playDiv, playDiv => {
		const topP = document.createElement('p')
		topP.style['font-weight'] = "bold"
		if(window.resPackLang){
			topP.setAttribute('lang', window.resPackLang)
		}
		topP.appendChild(document.createTextNode(pp.prompt.prompt))
		playDiv.appendChild(topP)
		
		let aI = 0
		let erstes = true
		for(let xPlayer of pp.players) {
			if (erstes) {
				erstes = false
			} else {
				const xNode = document.createElement('p')
				xNode.classList.add('answer')
				xNode.setAttribute('lang', uebersetz.languages)
				xNode.appendChild(textToNode(voteOr))
				playDiv.appendChild(xNode)
			}
			const outAnswer = xPlayer.answers[aI]
			{
				const xPAnswer = document.createElement('p')
				xPAnswer.classList.add('answer')
				xPAnswer.setAttribute('lang', outAnswer.lang)
				xPAnswer.appendChild(document.createTextNode(outAnswer.answer))
				playDiv.appendChild(xPAnswer)
			}
			if (round != maxRounds) {
				// pucgenie: how to refactor
				aI ^= 1
			}
		}
	}), choices => {
		if(!window.theResPack){
	return
		}
		try {
			const pfad1 = `${window.theResPack}/${choices.prompt.id}`
			lazyLoad(pfad1 + '/data.jet', rText => {
				// pucgenie: Announce the question text.
				let questionRead = new Audio(pfad1 + "/" + JSON.parse(rText)['fields'].filter(feld => feld['n'] == "PromptAudio")[0]['v'] + ".mp3")
				questionRead.addEventListener('ended', () => {
					const sepMsgT = {lang: undefined, text: undefined}
					{
						const ausG = []
						sepMsgT.lang = __('VoteOr', undefined, xTxt2 => ausG.push(xTxt2))
						sepMsgT.text = ausG.join('')
					}
					hintergrundmusik.pause()
					let prevMsg = undefined
					for(let xP of document.querySelectorAll('#playDiv .answer')) {
						const msg = new SpeechSynthesisUtterance()
						msg.text = xP.innerText
						msg.lang = xP.getAttribute('lang')
						if (!prevMsg) {
							window.speechSynthesis.speak(msg)
					continue
						}
						prevMsg.addEventListener('end', () => {
							const sepMsg = new SpeechSynthesisUtterance()
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
	})
}

function newGame(){
	gameCtrlDiv.style['display'] = 'none'
	replaceContentTranslated(prevDiv, "PreviousWinner", {Player: players[0]})
	round = 0
	allPlayers(p => {
		p.score = 0
		p.netPlayer.sendCmd('updateScore', 0)
	})
	// pucgenie: disabled exceptional line of code.
	//nextRound()
	// Now it is possible for players to leave and join before nextRound() is called (e.g. by tapping on a button).
	buttonDiv.style['display'] = 'block'
}

//helper & utility fns
function display(html){playDiv.innerHTML = html}

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
