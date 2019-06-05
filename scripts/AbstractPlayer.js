"use strict";

class AbstractPlayer {
	constructor(xnetPlayer, name, interfacingObj) {
		// pucgenie: never ever cache netplayer anywhere else. It may change during one game round.
		this.netPlayer = xnetPlayer
		this.name = name
		this.state = 'nameless'
		this.previousState = undefined
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
				if (interfacingObj.gameBegun){
					// pucgenie: the first player that reconnects using the name of a disconnected player "hijacks" that player's profile.
					xPlayer = interfacingObj.players.find(xPlayer => (!xPlayer.connected) && xPlayer.name === cmd.answer)
					if(!xPlayer){
						this.displayMessage("CantJoinRunningGame")
		throw `Ignored wrongly connecting player ${cmd.answer}`
					}
					// pucgenie: "this" changes. Event handlers are using arrow functions so we have to deregister the old ones and create new ones.
					xPlayer.unregisterEventHandlers()
					interfacingObj.newPlayers.splice(interfacingObj.newPlayers.indexOf(this), 1)
					// pucgenie: retains old xPlayer's state so we can resynchronize
					xPlayer.netPlayer = this.netPlayer
					xPlayer.connected = true
					xPlayer.registerEventHandlers()
				} else {
					xPlayer = this
					interfacingObj.newPlayers.splice(interfacingObj.newPlayers.indexOf(this), 1)
					interfacingObj.players.push(this)
					
					this.stateStep('rest')
					this.displayMessage("GetReady")
					interfacingObj.renderNewestPlayer(this)
				}
			}
		}
		
		this.syncMap = {
			'nameless': () => {
				this.netPlayer.sendCmd('updateScore', this.score)
			}
		}
		
		this.evtDisconnect = () => {
			let ndx = interfacingObj.newPlayers.indexOf(this)
			if (ndx >= 0){
				interfacingObj.newPlayers.splice(ndx, 1)
		return
			}
			ndx = interfacingObj.players.indexOf(this)
			if (ndx >= 0) {
				if(interfacingObj.gameBegun){
					// pucgenie: keep player for reconnect
					this.connected = false
				} else {
					interfacingObj.players.splice(ndx, 1)
				}
			} else {
				console.log({"notfound": this})
			}
			interfacingObj.renderTotalPlayersText()
		}
		
		this.evtReceiveAnswer = cmd => {
			//the idea is to check if the response is to the right question
			//to prevent errors
			//console.log(this);
			//console.log({"promptId":cmd.promptId, "answer":cmd.answer});
			if(cmd.answer===""){
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
			// pucgenie: FIXME: refactor, move to QuiplibrePlayer
			interfacingObj.roundLogic.pp.votes[cmd.index].push(this)
			if (interfacingObj.round != interfacingObj.maxRounds || ++this.voteCountR3 == maxRounds) {
				// WastedSpark(tm)
				this.voteCountR3 = 0
				this.stateStep('rest')
				this.displayMessage("YouVotedFor", {voteNumber: cmd.index+1})
				let stimmenSumme = 0
				for(let voteN of interfacingObj.roundLogic.pp.votes) {
					stimmenSumme += voteN.length
				}
				let voteFactor = interfacingObj.round == interfacingObj.maxRounds ? interfacingObj.maxRounds : 1
				if(stimmenSumme >= interfacingObj.players.length * voteFactor){
					if (stimmenSumme > interfacingObj.players.length * voteFactor) {
						console.log("There are more votes than players!")
					}
					
					interfacingObj.renderPreviousResults()
					interfacingObj.roundLogic.progressJudgement()
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
			this.netPlayer.sendCmd('displayPrompt', {id: 0, prompt: undefined, lang: undefined, color: this.color, resPack: QuiplibreConfig.theResPack})
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
