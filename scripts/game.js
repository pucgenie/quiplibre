"use strict";

const textCache = {
	voteOr: {text: undefined, lang: undefined}
}

const uebersetz = new Uebersetz('game_messages', uebersetz => {
	window.__ = (key, basis, func, joined) => uebersetz.__(uebersetz.languages, key, basis, func, joined)
	if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
		document.addEventListener('DOMContentLoaded', nachDemLaden, {once: true})
	} else {
		nachDemLaden()
	}
	// pucgenie: cache some texts
	const voarr = []
	textCache.voteOr.lang = __("VoteOr", undefined, Array.prototype.push.bind(voarr))
	textCache.voteOr.text = voarr.join('')
})

/**
 * pucgenie: This function is to be called when document is ready and translation files have been loaded.
**/
function nachDemLaden() {
	document.querySelectorAll('[data-tlk]').forEach(elem => {
		replaceContentTranslated(elem, elem.getAttribute('data-tlk'))
		//elem.removeAttribute('data-tlk')
	})
	const fortsetzer = evt => {
		hintergrundmusik.play()
	}
	if(QuiplibreConfig.secretHintergrundmusik){
		hintergrundmusik.setAttribute('src', QuiplibreConfig.secretHintergrundmusik)
		fortsetzer()
	}
	if(QuiplibreConfig.secretTitelvideo){
		titelvideo.setAttribute('src', QuiplibreConfig.secretTitelvideo)
		titelvideo.addEventListener('play', evt => {
			hintergrundmusik.pause()
		})
		titelvideo.addEventListener('pause', fortsetzer)
		titelvideo.addEventListener('ended', fortsetzer)
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

function pullPrompt(){
	if (window.prompts.length == 0){
return {prompt: "What's a good prompt for a round of Quiplibre? (Please send us the winning answer of this round, as you have exhausted our list of prompts)", id: 1}
	}
	return window.prompts.splice(Math.floor(Math.random()*window.prompts.length), 1)[0]
}

/**
 * Player events related to Quiplibre Textmode
**/
class QuiplibrePlayer extends AbstractPlayer {
	constructor(xnetPlayer, name, interfacingObj){
		super(xnetPlayer, name, interfacingObj)
		this.prompts = []
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
			this.answers.push(cmd)
		}
		this.syncMap['prompt1'] = () => {
			this.displayMessage("PleaseWaitForOtherAnswers")
			if(this.interfacingObj.roundLogic.allPlayersHaveAnswered()){
				console.log("all players answered.")
				this.interfacingObj.roundLogic.progressJudgement()
			}
		}
	}
	evtReceiveChoice(cmd) {
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
		this.interfacingObj.roundLogic.pp.votes[cmd.index].push(this)
		if (this.interfacingObj.round != this.interfacingObj.maxRounds || ++this.voteCountR3 == maxRounds) {
			// pucgenie: in any case - don't care if it already is zero at the moment
			this.voteCountR3 = 0
			
			this.stateStep('rest')
			this.displayMessage("YouVotedFor", {voteNumber: cmd.index+1})
			let stimmenSumme = 0
			for(let voteN of this.interfacingObj.roundLogic.pp.votes) {
				stimmenSumme += voteN.length
			}
			let voteFactor = this.interfacingObj.round == this.interfacingObj.maxRounds ? this.interfacingObj.maxRounds : 1
			if(stimmenSumme >= this.interfacingObj.players.length * voteFactor){
				if (stimmenSumme > this.interfacingObj.players.length * voteFactor) {
					console.log("There are more votes than players!")
				}
				
				this.interfacingObj.renderPreviousResults()
				this.interfacingObj.roundLogic.progressJudgement()
			}
		}
	}
	/**
	 * @override
	 */
	registerEventHandlers() {
		super.registerEventHandlers()
		this.netPlayer.addEventListener('receiveChoice', this.evtReceiveChoice)
	}
	/**
	 * @override
	 */
	unregisterEventHandlers(){
		super.unregisterEventHandlers()
		this.netPlayer.removeEventListener('receiveChoice', this.evtReceiveChoice)
	}
}

const happyfuntimes = require('happyfuntimes')

const server = new happyfuntimes.GameServer()

if(QuiplibreConfig.theResPack){
	lazyLoad(`${QuiplibreConfig.theResPack}.${QuiplibreConfig.dataFileExtension}`, rText => {
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
class QuiplibreContext {
	constructor(){
		this.gameBegun  = false
		this.players    = []
		this.newPlayers = []//new Array(3)
		this.round      = 0
		this.roundLogic = undefined
		this.maxRounds  = 3 //a nice number of rounds
	}
	renderTotalPlayersText() {
		__("TotalPlayers", {totalPlayerCount: this.players.length}, satz => playDiv.appendChild(textToNode(satz)))
	}
	renderPreviousResults() {
		attrDiv.style['visibility'] = 'hidden'
		replaceContent(prevDiv, prevDiv => {
			__("PreviousResults", undefined, satz => prevDiv.appendChild(textToNode(satz)))
			
			this.roundLogic.awardPoints((xPlayer, xVotes) => {
				const xPDe = document.createElement('p')
				__("wonVotesPoints", {"Player": xPlayer, "Votes": xVotes}, xNeu => xPDe.appendChild(textToNode(xNeu)))
				prevDiv.appendChild(xPDe)
			})
			
			prevDiv.appendChild(document.createElement('br'))
		})
	}
	renderNewestPlayer(xPlayer) {
		replaceContent(playDiv, playDiv => {
			__("LastPlayerJoined", undefined, satz => playDiv.appendChild(textToNode(satz)))
			const xB = document.createElement('b')
			xB.appendChild(document.createTextNode(xPlayer.name))
			xB.style['color'] = xPlayer.color
			playDiv.appendChild(xB)
			playDiv.appendChild(document.createElement('br'))
			this.renderTotalPlayersText()
		})
		if(this.players.length >= 2){
			btnNextRound.removeAttribute('disabled')
		}
	}
	nextRound(){
		if (this.players.length <= 1){
			replaceContentTranslated(playDiv, "NeedMorePlayers")
	return
		}
		btnNextRound.style['display']  = 'none'
		titelvideo.pause()
		titelvideo.style['display'] = 'none'
		attrDiv.style['visibility'] = 'hidden'
		//clearElementChilds(playDiv)
		this.gameBegun = true
		if (++this.round > this.maxRounds){
			this.sortPlayers()
			replaceContent(playDiv, playDiv => {
				playDiv.appendChild(replaceContentTranslated(document.createElement('p'), "GameEndedScore"))
				const xTbody = document.createElement('tbody')
				this.players.forEach(p => {
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
			attrDiv.style['visibility']  = 'visible'
			titelvideo.style['display']  = 'block'
			this.players.forEach(xPlayer => xPlayer.displayMessage("GameEnded"))
			// pucgenie: allows new players to join
			this.gameBegun = false
			// pucgenie: garbage
			this.roundLogic = undefined
	return
		}
		this.roundLogic = this.round < this.maxRounds ? new Round_1_2(this) : new Round_3(this)
		this.roundLogic.nextRound()
		replaceContentTranslated(playDiv, "RoundBanner", {roundNum: this.round})
	}
	perPPJudgement(pp) {
		replaceContent(playDiv, playDiv => {
			const topP = document.createElement('p')
			topP.style['font-weight'] = 'bold'
			if(QuiplibreConfig.resPackLang){
				topP.setAttribute('lang', QuiplibreConfig.resPackLang)
			}
			topP.appendChild(document.createTextNode(pp.prompt.prompt))
			playDiv.appendChild(topP)
			
			let aI = 0
			let erstes = true
			// pucgenie: microoptimization, enhances readability too
			const _voteOr = textCache.voteOr
			for (let i = 0; i < pp.players.length; ++i) {
				let xPlayer = pp.players[i]
				if (erstes) {
					erstes = false
				} else {
					playDiv.appendChild(createLangTextNode('answer', _voteOr.text, _voteOr.lang))
				}
				const outAnswer = xPlayer.answers[this.roundLogic.getAnswerIndex(i)]
				playDiv.appendChild(createLangTextNode('answer', outAnswer.answer, outAnswer.lang))
			}
		})
	}
	renderChoices(choices){
		if(!QuiplibreConfig.theResPack){
	return
		}
		try {
			const pfad1 = `${QuiplibreConfig.theResPack}/${choices.prompt.id}`
			lazyLoad(pfad1 + QuiplibreConfig.dataFileName, rText => {
				// pucgenie: Announce the question text.
				// pucgenie: TESTME: do expressions work in backtick syntax?
				const questionRead = new Audio(`${pfad1}/${JSON.parse(rText)['fields'].filter(feld => feld['n'] === "PromptAudio")[0]['v']}.mp3`)
				questionRead.addEventListener('ended', () => {
					hintergrundmusik.pause()
					let prevMsg = undefined
					for(let xP of document.querySelectorAll('#playDiv .answer')) {
						const msg = new SpeechSynthesisUtterance()
						msg.text = xP.innerText
						msg.lang = xP.getAttribute('lang')
						// pucgenie: as a workaround (SpeechSynthesisUtterance ignores lang), set <body lang="${choice.lang}">
						//document.setAttribute('lang', choice.lang)
						
						if (!prevMsg) {
							window.speechSynthesis.speak(msg)
					continue
						}
						prevMsg.addEventListener('end', () => {
							const sepMsg = new SpeechSynthesisUtterance()
							Object.assign(sepMsg, textCache.voteOr)
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
	}
	newGame(){
		gameCtrlDiv.style['display'] = 'none'
		replaceContentTranslated(prevDiv, "PreviousWinner", {Player: this.players[0]})
		this.round = 0
		// pucgenie: FIXME: move to RoundLogics
		this.allPlayers(p => {
			p.score = 0
			// pucgenie: FIXME: use syncCurrentStatus ?
			p.netPlayer.sendCmd('updateScore', 0)
		})
		// pucgenie: disabled exceptional line of code.
		//nextRound()
		// Now it is possible for players to leave and join before nextRound() is called (e.g. by tapping on a button).
		btnNextRound.style['display'] = 'block'
	}
	sortPlayers(){//descending. In-place and returns arr
		return this.players.sort((a, b) => (b.score - a.score))
	}
	playerConnect(netPlayer){
		// pucgenie: why does one player connect 2 times? (2019-05-05) --> __() called callback multiple times.
		//console.log(netPlayer)
		const tmpPlayerName = []
		__("Player", {playerNum: this.players.length+1}, Array.prototype.push.bind(tmpPlayerName))
		this.newPlayers.push(new QuiplibrePlayer(netPlayer, tmpPlayerName.join(''), this))
	}
	/**
	 * query all players or apply a fn to them
	**/
	allPlayers(pred){
		let ret = true
		for (let xPlayer of this.players) {
			ret = (pred(xPlayer)) && ret //must avoid short-circuit eval
		}
		return ret
	}
}

/**
 * Accessed by button click handlers.
 * @author pucgenie
**/
window.quiplCtx = new QuiplibreContext()
/**
 * A new player has arrived.
**/
server.on('playerconnect', QuiplibreContext.prototype.playerConnect.bind(quiplCtx))
