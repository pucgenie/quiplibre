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

function renderTotalPlayersText() {
	__("TotalPlayers", {totalPlayerCount: players.length}, satz => playDiv.appendChild(textToNode(satz)))
}

function renderNewestPlayer(xPlayer) {
	replaceContent(playDiv, playDiv => {
		__("LastPlayerJoined", undefined, satz => playDiv.appendChild(textToNode(satz)))
		const xB = document.createElement('b')
		xB.appendChild(document.createTextNode(xPlayer.name))
		xB.style['color'] = xPlayer.color
		playDiv.appendChild(xB)
		playDiv.appendChild(document.createElement('br'))
		renderTotalPlayersText()
	})
}

function renderPreviousResults() {
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
			this.answers.push(cmd.answer)
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
			if(interfacingObj.roundLogic.allPlayersHaveAnswered()){
				interfacingObj.roundLogic.progressJudgement()
			}
		}
	}
}

const happyfuntimes = require('happyfuntimes')

const server = new happyfuntimes.GameServer()

const maxRounds = 3 //a nice number of rounds

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

function perPPJudgement(pp) {
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
			const outAnswer = xPlayer.answers[roundLogic.getAnswerIndex(i)]
			playDiv.appendChild(createLangTextNode('answer', outAnswer.answer, outAnswer.lang))
		}
	})
}

function renderChoices(choices){
	if(!QuiplibreConfig.theResPack){
return
	}
	try {
		const pfad1 = `${QuiplibreConfig.theResPack}/${choices.prompt.id}`
		lazyLoad(pfad1 + QuiplibreConfig.dataFileName, rText => {
			// pucgenie: Announce the question text.
			let questionRead = new Audio(pfad1 + '/' + JSON.parse(rText)['fields'].filter(feld => feld['n'] === "PromptAudio")[0]['v'] + ".mp3")
			questionRead.addEventListener('ended', () => {
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
