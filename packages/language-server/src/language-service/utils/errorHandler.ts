export class ErrorHandler {
	private errorResultsList
	private textDocument

	constructor(textDocument) {
		this.errorResultsList = []
		this.textDocument = textDocument
	}

	addErrorResult(errorNode, errorMessage, errorType) {
		this.errorResultsList.push({
			severity: errorType,
			range: {
				start: this.textDocument.positionAt(errorNode.startPosition),
				end: this.textDocument.positionAt(errorNode.endPosition)
			},
			message: errorMessage
		})
	}

	getErrorResultsList() {
		return this.errorResultsList
	}
}
