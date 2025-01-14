"use strict"

import * as path from "path"

import { ExtensionContext, languages, workspace } from "vscode"
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from "vscode-languageclient"
import * as packageJSON from "../package.json"
import { schemaContributor } from "./schema-contributor"
import { createReporter, AnalyticsEvent, Exception } from "./analytics"

export interface ISchemaAssociations {
	[pattern: string]: string[]
}

let client: LanguageClient

const analytics = createReporter(
	`${packageJSON.publisher}.${packageJSON.name}`,
	packageJSON.version,
	"936e3290fec1ab6c784fb2a5d06d9d47"
)

interface AnalyticsPayload {
	action: string
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	attributes: { [key: string]: any }
}

interface ExceptionPayload {
	message: string
	stack: string
}

class GenericLanguageServerException extends Error {
	constructor(message: string, stack: string) {
		super()
		this.name = "GenericLanguageServerException"
		this.stack = stack
		this.message = message
	}
}

export async function activate(context: ExtensionContext) {
	const serverModule = context.asAbsolutePath(
		path.join(
			"node_modules",
			"@serverless-ide/language-server",
			"out",
			"server.js"
		)
	)

	const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] }

	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	}

	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ language: "yaml", scheme: "file" },
			{ language: "yaml", scheme: "untitled" }
		],
		synchronize: {
			configurationSection: [
				"serverlessIDE",
				"http.proxy",
				"http.proxyStrictSSL"
			],
			fileEvents: [
				workspace.createFileSystemWatcher("**/*.?(e)y?(a)ml"),
				workspace.createFileSystemWatcher("**/.clientrc")
			]
		}
	}

	client = new LanguageClient(
		"serverless-ide-client",
		"Serverless IDE: AWS SAM and CloudFormation Support",
		serverOptions,
		clientOptions
	)
	const disposable = client.start()

	client.onReady().then(() => {
		client.onNotification(
			"custom/analytics",
			(payload: AnalyticsPayload) => {
				// eslint-disable-next-line no-console
				analytics.sendEvent(
					new AnalyticsEvent(payload.action, payload.attributes)
				)
			}
		)

		client.onNotification(
			"custom/exception",
			(payload: ExceptionPayload) => {
				const error = new GenericLanguageServerException(
					payload.message,
					payload.stack
				)
				// eslint-disable-next-line no-console
				console.error(
					"[ServerlessIDE] Unhandled exception in language server: " +
						error
				)
				analytics.sendException(new Exception(error, {}))
			}
		)
	})

	context.subscriptions.push(disposable)
	context.subscriptions.push(analytics)

	languages.setLanguageConfiguration("yaml", {
		wordPattern: /("(?:[^\\\"]*(?:\\.)?)*"?)|[^\s{}\[\],:]+/
	})

	await analytics.sendEvent(new AnalyticsEvent("activated", {}))

	return schemaContributor
}

export async function deactivate(): Promise<void> {
	await analytics.sendEvent(new AnalyticsEvent("deactivated", {}))

	if (!client) {
		return undefined
	}
	analytics.dispose()
	return client.stop() as Promise<void>
}
