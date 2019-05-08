function lazyLoad(url, verarbeit, errHand) {
	if(!errHand) {
		errHand = (xhr, progressEvent) => console.debug('Loading [' + url + '], returned status of ' + xhr.status)
	}
	var xhr = new XMLHttpRequest()
	xhr.open('GET', url)
	xhr.onload = function(progressEvent) {
		if (this.status === 200) {
			verarbeit(this.responseText)
		} else {
			errHand(this, progressEvent)
		}
	}
	xhr.send()
}
