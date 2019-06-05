"use strict";

class AbstractRound {
	constructor(interfacingObj) {
		this.pp = undefined
		this.playerPairs = []//new Array(interfacingObj.players.length) //optimization+readability
		this.interfacingObj = interfacingObj
	}
	progressJudgement(){
		if (this.playerPairs.length == 0){
			this.interfacingObj.nextRound()
	return
		}
		this.pp = this.playerPairs.splice(Math.floor(Math.random()*this.playerPairs.length), 1)[0]
		this.interfacingObj.perPPJudgement(this.pp)
		const choices = {
			"possibilities": this.getAllAnswers(),
			"prompt": this.pp.prompt
		}
		this.interfacingObj.allPlayers(p => {
			p.netPlayer.sendCmd("displayChoice", choices)
			p.stateStep("choosing")
			p.promptId = choices.prompt.id
		})
		this.interfacingObj.renderChoices(choices)
	}
	awardPoints(perPlayer){
		const xPp = this.pp
		for(let i = xPp.votes.length; i --> 0;){
			let xPlayer = xPp.players[i]
			let xVotes = xPp.votes[i]
			xPlayer.score += xVotes.length * round
			xPlayer.netPlayer.sendCmd('updateScore', xPlayer.score)
			perPlayer(xPlayer, xVotes)
		}
	}
	initVotesArray(voarrN) {
		const voarr = new Array(voarrN)
		for(let i = voarr.length; i --> 0;) {
			voarr[i] = []
		}
		return voarr
	}
	nextRound(){
		this.nextRound1()
		for (let xPlayer of this.interfacingObj.players) {
			xPlayer.stateStep(this.roundLogic.getFirstStep())
			
			xPlayer.promptId = xPlayer.prompts[0].id
			xPlayer.netPlayer.sendCmd('displayPrompt', xPlayer.prompts[0])
		}
	}
}

class PlayerPair {
	constructor(a, b, voarr){
		const xPrompt = pullPrompt()
		this.players = [a, b]
		this.prompt = xPrompt
		a.prompts[0] = xPrompt
		b.prompts[1] = xPrompt
		this.votes = voarr
	}
}

PlayerPair.prototype.toString = function(){
	return this.players.join(' & ')
}

class Round_1_2 extends AbstractRound {
	constructor(interfacingObj){
		super(interfacingObj)
	}
	static resetPlayer(p) {
		p.prompts = []//new Array(2) //optimization+readability
		p.answers = []//new Array(2) //optimization+readability
	}
	nextRound1() {
		const players = this.interfacingObj.players
		// pucgenie: shuffle players so that matchmaking is less complex
		shuffle(players)
		let i = players.length
		let xLP      = players[--i]
		const firstP = players[0]
		Round_1_2.resetPlayer(xLP)
		Round_1_2.resetPlayer(firstP)
		const _pps = this.playerPairs
		_pps.push(new PlayerPair(firstP, xLP, this.initVotesArray(2)))
		for(let p; i --> 1;) {
			p = players[i]
			Round_1_2.resetPlayer(p)
			_pps.push(new PlayerPair(xLP, p, this.initVotesArray(2)))
			xLP = p
		}
		// pucgenie: link 2nd to 1st player
		_pps.push(new PlayerPair(xLP, firstP, this.initVotesArray(2)))
	}
	getAllAnswers() {
		// pucgenie: i-th player's answer #i
		return this.pp.players.map((p,i) => p.answers[i])
		//return [this.pp.players[0].answers[0], this.pp.players[1].answers[1]]
	}
	allPlayersHaveAnswered(){
		return this.interfacingObj.allPlayers(p => p.answers.length==2)
	}
	getAnswerIndex(playerIndex){
		return playerIndex
	}
	getFirstStep(){
		return 'prompt0'
	}
}

class Round_3 extends AbstractRound {
	constructor(interfacingObj){
		super(interfacingObj)
	}
	nextRound1() {
		const xPrompts = [pullPrompt()]
		const ppair = {players: this.interfacingObj.players, prompt: xPrompts[0], votes: this.initVotesArray(players.length)}
		
		this.playerPairs.push(ppair)
		for (let xPlayer of this.interfacingObj.players) { //todo: could refactor this to use allPlayers
			xPlayer.prompts = xPrompts
			xPlayer.answers = []//new Array(1)
		}
	}
	getAllAnswers() {
		return this.pp.players.map(xPlayer => xPlayer.answers[0])
	}
	allPlayersHaveAnswered(){
		return this.interfacingObj.allPlayers(p => p.answers.length==1)
	}
	getAnswerIndex(playerIndex){
		return playerIndex
	}
	getFirstStep(){
		return 'prompt1'
	}
}
