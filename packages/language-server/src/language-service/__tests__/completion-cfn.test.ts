import { TextDocument } from "vscode-languageserver"
import { getLanguageService } from "../languageService"
import { getDefaultLanguageSettings } from "../model/settings"
import { parse as parseYAML } from "../parser"
import { completionHelper } from "../utils/completion-helper"

const languageSettings = getDefaultLanguageSettings()
const languageService = getLanguageService(languageSettings)

describe("Auto Completion Tests", () => {
	describe("doComplete", () => {
		const setup = (content: string) => {
			return TextDocument.create(
				"file://~/Desktop/cfn.yaml",
				"yaml",
				0,
				content
			)
		}

		const parseSetup = (content: string, offset: number) => {
			const testTextDocument = setup(content)
			const position = testTextDocument.positionAt(offset)
			const output = completionHelper(testTextDocument, position)

			return languageService.doComplete(
				testTextDocument,
				output.newPosition,
				parseYAML(output.newText)
			)
		}

		test("should autocomplete on the root node", async () => {
			const content = [
				"AWSTemplateFormatVersion: 2010-09-09",
				"Resources:"
			].join("\n")
			const result = await parseSetup(content, content.length - 1)
			expect(result.items).not.toHaveLength(0)
			expect(result).toMatchSnapshot()
		})

		test.skip("should autocomplete resources", async () => {
			const content = [
				"AWSTemplateFormatVersion: 2010-09-09",
				"Resources:",
				"  AWS::Dyna"
			].join("\n")
			const result = await parseSetup(content, content.length - 1)
			expect(result.items).not.toHaveLength(0)
			expect(result).toMatchSnapshot()
		})
	})
})
