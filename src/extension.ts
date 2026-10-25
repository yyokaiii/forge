/*
! TODO: support oneliners as well; for example: // * this should be colored purple
! FIXME: Known issue - if text in py is triple-quoted (text = """ # ! test """), it is colored, gotta fix that
*/
import * as vscode from 'vscode';

// types
type markers = '!' | '?' | '+' | '-' | '*';

// markersettings
// thinking of leaving it with predefined values of defaultColors,
// might think of adding a settings page to change the colors
// ? settings page
// ! DECIDE
const markersettings: Record<markers, { key: string; defaultColor: string }> = {
	'!': { key: 'exclamation', defaultColor: '#c1121f' },
	'?': { key: 'question', defaultColor: '#0077b6' },
	'+': { key: 'plus', defaultColor: '#16db65' },
	'-': { key: 'minus', defaultColor: '#f9a620' },
	'*': { key: 'asterisk', defaultColor: '#8367c7' },
};

const cfgsection = 'forge.commentColors';
const decorations = new Map<markers, vscode.TextEditorDecorationType>();

function isJS(languageId: string) {
	return languageId === 'javascript' || languageId === 'javascriptreact';
}

function isPY(languageId: string) {
	return languageId === 'python';
}

// main
function createdeco(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration(cfgsection);
	for (const [marker, { key, defaultColor }] of Object.entries(markersettings) as [markers, { key: string; defaultColor: string }][]) {
		const color = config.get<string>(`${key}.color`, defaultColor);
		const decoration = vscode.window.createTextEditorDecorationType({ color });
		decorations.set(marker, decoration);
		context.subscriptions.push(decoration);
	}
}

// update
function update(editor: vscode.TextEditor) {
	for (const marker of Object.keys(markersettings) as markers[]) {
		const supported = isJS(editor.document.languageId) || isPY(editor.document.languageId);
		const key = markersettings[marker].key;
		const enabled = vscode.workspace.getConfiguration(cfgsection).get<boolean>(`${key}.enabled`, true);
		editor.setDecorations(decorations.get(marker)!, enabled && supported ? findsegments(editor.document, marker) : [],
		);
	}
}

// py support
// really simple, searching for # only because py doesnt have multi-liners, you must do # line1 # line2 etc..
// like for example js has /* space space */
function findsegmentspy(document: vscode.TextDocument, marker: markers,): vscode.Range[] {
	const ranges: vscode.Range[] = [];
	const pythoncomment = /^(\s*#\s*)([!?+*-])/;

	for (let lineN = 0; lineN < document.lineCount; lineN++) {
		const line = document.lineAt(lineN);
		const match = pythoncomment.exec(line.text);

		if (match?.[2] === marker) {
			ranges.push(new vscode.Range(
				lineN,
				match[1].length,
				lineN,
				line.text.length,
			));
		}
	}

	return ranges;
}

// finds start and ends of comment "segments" / starting lines
// maybe we can do it in less lines?
// ! RECHECK
// ? segments
function findsegmentsjs(document: vscode.TextDocument, marker: markers): vscode.Range[] {
	const text = document.getText();
	const segmentsline: Array<Array<{ start: number; end: number }>> = Array.from(
		{ length: document.lineCount },
		() => [],
	);
	let state: 'code' | 'block' | 'line' | 'single' | 'double' | 'template' = 'code';
	let escaped = false;
	let segmentstart = -1;
	let line = 0;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const next = text[i + 1];

		if (char === '\n') {
			if (state === 'block' && segmentstart >= 0) {
				segmentsline[line].push({ start: segmentstart, end: i });
				segmentstart = i + 1;
			} else if (state === 'line' || state === 'single' || state === 'double') {
				state = 'code';
				escaped = false;
			}
			line++;
			continue;
		}

		if (state === 'block') {
			if (char === '*' && next === '/') {
				segmentsline[line].push({ start: segmentstart, end: i });
				segmentstart = -1;
				state = 'code';
				i++;
			}
			continue;
		}
		if (state === 'line') continue;
		if (state === 'single' || state === 'double' || state === 'template') {
			if (escaped) escaped = false;
			else if (char === '\\') escaped = true;
			else if ((state === 'single' && char === "'") || (state === 'double' && char === '"') || (state === 'template' && char === '`')) state = 'code';
			continue;
		}

		if (char === '/' && next === '*') {
			state = 'block';
			segmentstart = i + 2;
			i++;
		} else if (char === '/' && next === '/') {
			state = 'line';
			i++;
		} else if (char === "'") state = 'single';
		else if (char === '"') state = 'double';
		else if (char === '`') state = 'template';
	}

	if (state === 'block' && segmentstart >= 0 && line < segmentsline.length) {
		segmentsline[line].push({ start: segmentstart, end: text.length });
	}

	const ranges: vscode.Range[] = [];
	for (let lineN = 0; lineN < segmentsline.length; lineN++) {
		for (const segment of segmentsline[lineN]) {
			const content = text.slice(segment.start, segment.end);
			const leading = content.match(/^\s*/)?.[0].length ?? 0;
			let offsetmarker = segment.start + leading;
			if (marker !== '*' && text[offsetmarker] === '*') {
				let afterprefix = offsetmarker + 1;
				while (/\s/.test(text[afterprefix] ?? '') && afterprefix < segment.end) afterprefix++;
				if (text[afterprefix] === marker) offsetmarker = afterprefix;
			}
			if (text[offsetmarker] !== marker) continue;
			const endline = Math.min(segment.end, document.offsetAt(document.lineAt(lineN).range.end));
			ranges.push(new vscode.Range(document.positionAt(offsetmarker), document.positionAt(endline)));
			break;
		}
	}
	return ranges;
}

// detects file lang by using the funcs above
function findsegments(document: vscode.TextDocument, marker: markers) {
	if (isPY(document.languageId)) {
		return findsegmentspy(document, marker);
	}

	if (isJS(document.languageId)) {
		return findsegmentsjs(document, marker);
	}

	return [];
}

// core
export function activate(context: vscode.ExtensionContext) {
	// might remove
	// ? debug cmd
	// ! DECIDE
	const debugcmd = vscode.commands.registerCommand('forge.debugcmd', () => {
		vscode.window.showInformationMessage("return 1 (success)");
		vscode.window.showErrorMessage("Only for me to see if the extension loaded correctly.")
	})
	context.subscriptions.push(debugcmd);
	createdeco(context);

	const refresh = () => {
		for (const editor of vscode.window.visibleTextEditors) {
			update(editor);
		}
	};

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			const editor = vscode.window.visibleTextEditors.find(candidate => candidate.document === event.document);
			if (editor) update(editor);
		}),
		vscode.window.onDidChangeActiveTextEditor(refresh),
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(cfgsection)) {
				for (const decoration of decorations.values()) decoration.dispose();
				decorations.clear();
				createdeco(context);
				refresh();
			}
		}),
	);

	refresh();
}

export function deactivate() { }
