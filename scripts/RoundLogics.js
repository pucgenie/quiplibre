"use strict";

class AbstractRound {
	constructor(interfacingObj, round, roundSettings) {
		this.pp = undefined
		this.round = round
		this.roundSettings = roundSettings
		this.prompts = []// [{id: promptid, answerPlayers: [player,... ], answers: [{answer: answer, lang: lang},... ], votePlayers: [player,...], votes: [answerIndex,...]},... ]
		this.players = interfacingObj.players
		this.playerPairs = []//new Array(interfacingObj.players.length) //optimization+readability
		this.interfacingObj = interfacingObj
	}
	getPromptID(index) {
		return this.prompts[index].id
	}
	getAnswers(index) {
		return this.prompts[index].answers
	}
	getAnswer(index, answer_index) {
		return this.prompts[index].answers[answer_index]
	}
	getAnswerPlayers() {
		return this.players
	}
	getVotePlayers() {
		return this.players
	}
	getNrPrompts() {
		if (roundSettings.nrPrompts != undefined) {
			return roundSettings.nrPrompts
		}
		return 1 // provide sane default
	}
	getAnswerPlayersPerPrompt(answerPlayers, index) {
		return answerPlayers
	}
	getVotePlayersPerPrompt(votePlayers, index) {
		return votePlayers
	}
	start() {
		answerPlayers = this.getAnswerPlayers()
		answerPlayers.shuffle()
		votePlayers = this.getVotePlayers()
		votePlayers.shuffle()
		// initialize the prompts array and pair the players if necessary
		for(let i = 0; i < this.getNrPrompts(); i++) {
			this.prompts.append( {id: pullPrompt(), answerPlayers: [], answers: [], votePlayers: [], votes: []} )
		}
		for(let i = 0; i < this.prompts.length; i++) {
			this.prompts[i].answerPlayers = this.getAnswerPlayersPerPrompt(answerPlayers, i)
			this.prompts[i].votePlayers = this.getVotePlayersPerPrompt(votePlayers, i)
		}
	}

	// TODO: restructure to fill voteplayers and votes with 0,
	// then find voteplayer index, and assign vote at the same index
	voteAnswer(index, player, answer) {
		votenr = this.prompts[index].votes.length
		this.prompts[index].votePlayers[votenr] = player
		this.prompts[index].votes[votenr] = answer
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
			xPlayer.score += xVotes.length * this.interfacingObj.round
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
			xPlayer.stateStep(this.getFirstStep())
			
			xPlayer.promptId = xPlayer.prompts[0].id
			xPlayer.netPlayer.sendCmd('displayPrompt', xPlayer.prompts[0])
		}
	}
	voteFor(choiceIdx, player) {
		this.pp.votes[choiceIdx].push(player)
	}
	sumVotes() {
		let stimmenSumme = 0
		for(let voteN of this.pp.votes) {
			stimmenSumme += voteN.length
		}
		return stimmenSumme
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

class RoundPairing extends AbstractRound {
	constructor(interfacingObj, roundConfig){
		super(interfacingObj, interfacingObj.round, roundConfig)
	}
	static resetPlayer(p) {
		p.prompts = []//new Array(2) //optimization+readability
		p.answers = []//new Array(2) //optimization+readability
	}
	getNrPrompts() { // override because prompt is per player
		return super.getNrPrompts() * interfacingObj.players.length;
	}
	getAnswerPlayersPerPrompt(answerPlayers, index) {
		// need to have a combination of 2 players but kinda fairly divided
		// since they are shuffled, we can just take the index and the next one (rolling over)
		// if more questions or we go over max players, we should just use the mod function; that will make the first and last one as a pair
		return [ answerPlayers[index % answerPlayers.length], answerPlayers[(index + 1) % answerPlayers.length] ]
	}
	nextRound1() {
		const players = this.interfacingObj.players
		// pucgenie: shuffle players so that matchmaking is less complex
		shuffle(players)
		let i = players.length
		let xLP      = players[--i]
		const firstP = players[0]
		RoundPairing.resetPlayer(xLP)
		RoundPairing.resetPlayer(firstP)
		const _pps = this.playerPairs
		_pps.push(new PlayerPair(firstP, xLP, this.initVotesArray(2)))
		for(let p; i --> 1;) {
			p = players[i]
			RoundPairing.resetPlayer(p)
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
		return this.interfacingObj.players.every(p => p.answers.length==2)
	}
	getAnswerIndex(playerIndex){
		return playerIndex
	}
	getFirstStep(){
		return 'prompt0'
	}
}

class RoundNormal extends AbstractRound {
	constructor(interfacingObj, roundConfig){
		super(interfacingObj, interfacingObj.round, roundConfig)
	}
	nextRound1() {
		const xPrompts = [pullPrompt()]
		const ppair = {players: this.interfacingObj.players, prompt: xPrompts[0], votes: this.initVotesArray(this.interfacingObj.players.length)}
		
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
		// pucgenie: may abort at first falsey occurence
		return this.interfacingObj.players.every(p => p.answers.length==1)
	}
	getAnswerIndex(playerIndex){
		return playerIndex
	}
	getFirstStep(){
		return 'prompt1'
	}
}
