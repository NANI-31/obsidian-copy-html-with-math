import {
	App,
	arrayBufferToBase64,
	Component,
	Editor,
	FileSystemAdapter,
	htmlToMarkdown,
	MarkdownRenderer,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile
} from 'obsidian';
import katex from 'katex';

/*
 * Generic lib functions
 */

/**
 * Like Promise.all(), but with a callback to indicate progress. Graciously lifted from
 * https://stackoverflow.com/a/42342373/1341132
 */
function allWithProgress(promises: Promise<never>[], callback: (percentCompleted: number) => void) {
	let count = 0;
	callback(0);
	for (const promise of promises) {
		void promise.then(() => {
			count++;
			callback((count * 100) / promises.length);
		}).catch(() => {
			count++;
		});
	}
	return Promise.all(promises);
}

/**
 * Do nothing for a while
 */
async function delay(milliseconds: number): Promise<void> {
	return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

/**
 * Static assets
 */

const DEFAULT_STYLESHEET =
	`body,input {
  font-family: "Roboto","Helvetica Neue",Helvetica,Arial,sans-serif
}

code, kbd {
  font-family: "Roboto Mono", "Courier New", Courier, monospace;
  background-color: #f5f5f5;
  padding: 0.1em 0.3em;
  border-radius: 3px;
}

pre {
  font-family: "Roboto Mono", "Courier New", Courier, monospace;
  padding: 0.8em 1em;
  border: 1px solid #ddd;
  border-radius: 4px;
}

pre code {
  background-color: transparent !important;
  padding: 0 !important;
  border: none !important;
}

table {
  background: white;
  border: 1px solid #666;
  border-collapse: collapse;
  padding: 0.5em;
}

table thead th,
table tfoot th {
  text-align: left;
  background-color: #eaeaea;
  color: black;
}

table th, table td {
  border: 1px solid #ddd;
  padding: 0.5em;
}

table td {
  color: #222222;
}

.callout[data-callout="abstract"] .callout-title,
.callout[data-callout="summary"] .callout-title,
.callout[data-callout="tldr"]  .callout-title,
.callout[data-callout="faq"] .callout-title,
.callout[data-callout="info"] .callout-title,
.callout[data-callout="help"] .callout-title {
  background-color: #828ee7;
}
.callout[data-callout="tip"] .callout-title,
.callout[data-callout="hint"] .callout-title,
.callout[data-callout="important"] .callout-title {
  background-color: #34bbe6;
}
.callout[data-callout="success"] .callout-title,
.callout[data-callout="check"] .callout-title,
.callout[data-callout="done"] .callout-title {
  background-color: #a3e048;
}
.callout[data-callout="question"] .callout-title,
.callout[data-callout="todo"] .callout-title {
  background-color: #49da9a;
}
.callout[data-callout="caution"] .callout-title,
.callout[data-callout="attention"] .callout-title {
  background-color: #f7d038;
}
.callout[data-callout="warning"] .callout-title,
.callout[data-callout="missing"] .callout-title,
.callout[data-callout="bug"] .callout-title {
  background-color: #eb7532;
}
.callout[data-callout="failure"] .callout-title,
.callout[data-callout="fail"] .callout-title,
.callout[data-callout="danger"] .callout-title,
.callout[data-callout="error"] .callout-title {
  background-color: #e6261f;
}
.callout[data-callout="example"] .callout-title {
  background-color: #d23be7;
}
.callout[data-callout="quote"] .callout-title,
.callout[data-callout="cite"] .callout-title {
  background-color: #aaaaaa;
}

.callout-icon {
  flex: 0 0 auto;
  display: flex;
  align-self: center;
}

svg.svg-icon {
  height: 18px;
  width: 18px;
  stroke-width: 1.75px;
}

.callout {
  overflow: hidden;
  margin: 1em 0;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.14), 0 1px 5px 0 rgba(0, 0, 0, 0.12), 0 3px 1px -2px rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.callout-title {
  padding: .5em;
  display: flex;
  gap: 8px;
  font-size: inherit;
  color: black;
  line-height: 1.3em;
}

.callout-title-inner {
  font-weight: bold;
  color: black;
}

.callout-content {
  overflow-x: auto;
  padding: 0.25em .5em;
  color: #222222;
  background-color: white !important;
}

ul.contains-task-list {
  padding-left: 0;
  list-style: none;
}

ul.contains-task-list ul.contains-task-list {
  padding-left: 2em;
}

ul.contains-task-list li input[type="checkbox"] {
  margin-right: .5em;
}

.callout-table,
.callout-table tr,
.callout-table p {
  width: 100%;
  padding: 0;
}

.callout-table td {
  width: 100%;
  padding: 0 1em;
}

.callout-table p {
  padding-bottom: 0.5em;
}

.source-table {
  width: 100%;
  border: 1px solid #ddd;
  border-collapse: collapse;
  margin: 1em 0;
}

.source-table td {
  border: 1px solid #ddd;
  padding: 0.6em 0.8em;
}

.source-table pre {
  margin: 0;
  padding: 0;
  background-color: transparent !important;
  border: none !important;
}

math {
  font-family: "Cambria Math", "Latin Modern Math", STIXGeneral, serif;
}

.math-block {
  text-align: center;
  margin: 1.2em 0;
}
`;

// Thank you again Olivier Balfour !
const MERMAID_STYLESHEET = `
:root {
  --default-font: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif;
  --font-monospace: 'Source Code Pro', monospace;
  --background-primary: #ffffff;
  --background-modifier-border: #ddd;
  --text-accent: #705dcf;
  --text-accent-hover: #7a6ae6;
  --text-normal: #2e3338;
  --background-secondary: #f2f3f5;
  --background-secondary-alt: #fcfcfc;
  --text-muted: #888888;
  --font-mermaid: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif;
  --text-error: #E4374B;
  --background-primary-alt: '#fafafa';
  --background-accent: '';
  --interactive-accent: hsl( 254,  80%, calc( 68% + 2.5%));
  --background-modifier-error: #E4374B;
  --background-primary-alt: #fafafa;
  --background-modifier-border: #e0e0e0;
}
`;

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>\${title}</title>
  <style>
    \${MERMAID_STYLESHEET}
    \${stylesheet}
  </style>
</head>
<body>
\${body}
</body>
</html>
`;


/*
 * Plugin code
 */

/** Don't allow multiple copy processes to run at the same time */
let copyIsRunning = false;

/** true while a block is being processed by MarkDownPostProcessor instances */
let ppIsProcessing = false;

/** moment at which the last block finished post-processing */
let ppLastBlockDate = Date.now();


enum FootnoteHandling {
	/** Remove references and links */
	REMOVE_ALL,

	/** Reference links to footnote using a unique id */
	LEAVE_LINK,

	/** Links are removed from reference and back-link from footnote */
	REMOVE_LINK,

	/** Footnote is moved to title attribute */
	TITLE_ATTRIBUTE
}

enum InternalLinkHandling {
	/**
	 * remove link and only display link text
	 */
	CONVERT_TO_TEXT,

	/**
	 * convert to an obsidian:// link to open the file or tag in Obsidian
	 */
	CONVERT_TO_OBSIDIAN_URI,

	/**
	 * Keep link, but convert extension to .html
	 */
	LINK_TO_HTML,

	/**
	 * Keep generated link
	 */
	LEAVE_AS_IS
}

enum MathHandling {
	/**
	 * Convert math ($...$ and $$...$$) to MathML (<math>).
	 * Pastes into Microsoft Word, Google Docs, Apple Pages, and LibreOffice as native, editable equations.
	 */
	MATHML = "mathml",

	/**
	 * Convert math to KaTeX HTML with embedded MathML fallback.
	 * Best for web apps, Notion, Anki, Gmail, and blogs.
	 */
	HTML_MATHML = "html-mathml",

	/**
	 * Leave math as raw LaTeX code ($...$).
	 */
	AS_IS = "as-is"
}

/**
 * Options for DocumentRenderer
 */
type DocumentRendererOptions = {
	convertSvgToBitmap: boolean,
	removeFrontMatter: boolean,
	formatCodeWithTables: boolean,
	formatCalloutsWithTables: boolean,
	embedExternalLinks: boolean,
	removeDataviewMetadataLines: boolean,
	footnoteHandling: FootnoteHandling,
	internalLinkHandling: InternalLinkHandling,
	disableImageEmbedding: boolean,
	mathHandling: MathHandling,
	codeBlockBackground: boolean
};

const documentRendererDefaults: DocumentRendererOptions = {
	convertSvgToBitmap: true,
	removeFrontMatter: true,
	formatCodeWithTables: true,
	formatCalloutsWithTables: false,
	embedExternalLinks: false,
	removeDataviewMetadataLines: false,
	footnoteHandling: FootnoteHandling.REMOVE_LINK,
	internalLinkHandling: InternalLinkHandling.CONVERT_TO_TEXT,
	disableImageEmbedding: false,
	mathHandling: MathHandling.MATHML,
	codeBlockBackground: false
};

/**
 * Render markdown to DOM, with some clean-up and embed images as data uris.
 */
class DocumentRenderer {
	private modal: CopyingToHtmlModal;
	private view: Component;
	private mathItems: Map<string, { tex: string; isBlock: boolean }> = new Map();

	// time required after last block was rendered before we decide that rendering a view is completed
	private optionRenderSettlingDelay: number = 100;

	// only those which are different from image/${extension}
	private readonly mimeMap = new Map([
		['svg', 'image/svg+xml'],
		['jpg', 'image/jpeg'],
	]);

	private readonly externalSchemes = ['http', 'https'];

	private readonly vaultPath: string;
	private readonly vaultLocalUriPrefix: string;
	private readonly vaultOpenUri: string;
	private readonly vaultSearchUri: string;

	constructor(private app: App,
				private options: DocumentRendererOptions = documentRendererDefaults) {
		this.vaultPath = (this.app.vault.getRoot().vault.adapter as FileSystemAdapter).getBasePath()
			.replace(/\\/g, '/');

		this.vaultLocalUriPrefix = `app://local/${this.vaultPath}`;

		this.vaultOpenUri = `obsidian://open?vault=${encodeURIComponent(this.app.vault.getName())}`;
		this.vaultSearchUri = `obsidian://search?vault=${encodeURIComponent(this.app.vault.getName())}`;

		this.view = new Component();
	}

	/**
	 * Render document into detached HTMLElement
	 */
	public async renderDocument(markdown: string, path: string): Promise<HTMLElement> {
		this.modal = new CopyingToHtmlModal(this.app);
		this.modal.open();

		try {
			const topNode = await this.renderMarkdown(markdown, path);
			return await this.transformHTML(topNode);
		} finally {
			this.modal.close();
		}
	}

	/**
	 * Render current view into HTMLElement, expanding embedded links
	 */
	private async renderMarkdown(markdown: string, path: string): Promise<HTMLElement> {
		this.mathItems.clear();
		let processedMarkdown = this.preprocessMarkdown(markdown);
		if (this.options.mathHandling !== MathHandling.AS_IS) {
			processedMarkdown = this.tokenizeMath(processedMarkdown);
		}

		const wrapper = createDiv({ cls: 'copy-as-html-hidden' });
		document.body.appendChild(wrapper);
		await MarkdownRenderer.render(this.app, processedMarkdown, wrapper, path, this.view);
		await this.untilRendered();

		await this.loadComponents(this.view);

		const result = wrapper.cloneNode(true) as HTMLElement;
		document.body.removeChild(wrapper);

		this.view.unload();
		return result;
	}

	/**
	 * Some plugins may expose components that rely on onload() to be called which isn't the case due to the
	 * way we render the markdown. We need to call onload() on all components to ensure they are properly loaded.
	 * Since this is a bit of a hack (we need to access Obsidian internals), we limit this to components of which
	 * we know that they don't get rendered correctly otherwise.
	 * We attempt to make sure that if the Obsidian internals change, this will fail gracefully.
	 */
	private async loadComponents(view: Component) {
		interface InternalComponent {
			_children?: Component[];
			onload?: () => Promise<void> | void;
		}

		const internalView = view as unknown as InternalComponent;

		// recursively call onload() on all children, depth-first
		const loadChildren = async (
			component: Component,
			visited: Set<Component> = new Set()
		): Promise<void> => {
			if (visited.has(component)) {
				return;  // Skip if already visited
			}

			visited.add(component);

			const internalComponent = component as unknown as InternalComponent;

			if (internalComponent._children?.length) {
				for (const child of internalComponent._children) {
					await loadChildren(child, visited);
				}
			}

			try {
				// relies on the Sheet plugin (advanced-table-xt) not to be minified
				if (component?.constructor?.name === 'SheetElement') {
					const sheet = component as unknown as { onload?: () => Promise<void> | void };
					if (typeof sheet.onload === 'function') {
						await sheet.onload();
					}
				}
			} catch (error) {
				console.error(`Error calling onload()`, error);
			}
		};

		await loadChildren(view);
	}

	private preprocessMarkdown(markdown: string): string {
		let processed = markdown;

		if (this.options.removeDataviewMetadataLines) {
			processed = processed.replace(/^[^ \t:#`<>][^:#`<>]+::.*$/gm, '');
		}

		return processed;
	}

	/**
	 * Wait until the view has finished rendering
	 *
	 * Beware, this is a dirty hack...
	 *
	 * We have no reliable way to know if the document finished rendering. For instance dataviews or task blocks
	 * may not have been post processed.
	 * MarkdownPostProcessors are called on all the "blocks" in the HTML view. So we register one post-processor
	 * with high-priority (low-number to mark the block as being processed), and another one with low-priority that
	 * runs after all other post-processors.
	 * Now if we see that no blocks are being post-processed, it can mean 2 things :
	 *  - either we are between blocks
	 *  - or we finished rendering the view
	 * On the premise that the time that elapses between the post-processing of consecutive blocks is always very
	 * short (just iteration, no work is done), we conclude that the render is finished if no block has been
	 * rendered for enough time.
	 */
	private async untilRendered() {
		while (ppIsProcessing || Date.now() - ppLastBlockDate < this.optionRenderSettlingDelay) {
			if (ppLastBlockDate === 0) {
				break;
			}
			await delay(20);
		}
	}

	/**
	 * Transform rendered markdown to clean it up and embed images
	 */
	private async transformHTML(element: HTMLElement): Promise<HTMLElement> {
		// Remove styling which forces the preview to fill the window vertically
		// @ts-ignore
		const node: HTMLElement = element.cloneNode(true);
		node.removeAttribute('style');

		if (this.options.removeFrontMatter) {
			this.removeFrontMatter(node);
		}

		this.replaceLinksOfClass(node, 'internal-link');
		this.replaceLinksOfClass(node, 'tag');
		this.makeCheckboxesReadOnly(node);
		this.removeCollapseIndicators(node);
		this.removeButtons(node);
		this.removeStrangeNewWorldsLinks(node);

		if (this.options.formatCodeWithTables) {
			this.transformCodeToTables(node);
		} else {
			node.querySelectorAll('pre').forEach(pre => {
				pre.style.backgroundColor = this.options.codeBlockBackground ? '#f5f5f5' : 'transparent';
			});
		}

		if (this.options.formatCalloutsWithTables) {
			this.transformCalloutsToTables(node);
		}

		if (this.options.footnoteHandling == FootnoteHandling.REMOVE_ALL) {
			this.removeAllFootnotes(node);
		}
		if (this.options.footnoteHandling == FootnoteHandling.REMOVE_LINK) {
			this.removeFootnoteLinks(node);
		} else if (this.options.footnoteHandling == FootnoteHandling.TITLE_ATTRIBUTE) {
			// not supported yet
		}

		if (this.options.mathHandling !== MathHandling.AS_IS) {
			this.renderMathElements(node);
		}

		if (!this.options.disableImageEmbedding) {
			await this.embedImages(node);
			await this.renderSvg(node);
		}

		return node;
	}

	/** Remove front-matter */
	private removeFrontMatter(node: HTMLElement) {
		node.querySelectorAll('.frontmatter, .frontmatter-container')
			.forEach(node => node.remove());
	}

	private replaceLinksOfClass(node: HTMLElement, className: string) {
		if (this.options.internalLinkHandling === InternalLinkHandling.LEAVE_AS_IS) {
			return;
		}

		node.querySelectorAll(`a.${className}`)
			.forEach(linkEl => {
				const href = linkEl.getAttribute('href') ?? '';
				const text = linkEl.getText();

				switch (this.options.internalLinkHandling) {
					case InternalLinkHandling.CONVERT_TO_OBSIDIAN_URI: {
						let uri = '';
						if (className === 'tag') {
							uri = this.vaultSearchUri + "&query=tag:" + encodeURIComponent(href);
						} else {
							if (href.startsWith('#')) {
								uri = href;
							} else {
								uri = this.vaultOpenUri + "&file=" + encodeURIComponent(href);
							}
						}
						const linkNode = createEl('a', { text, cls: className, href: uri });
						linkEl.replaceWith(linkNode);
					}
						break;

					case InternalLinkHandling.LINK_TO_HTML: {
						let htmlHref = href;
						if (!href.startsWith('#')) {
							htmlHref = href.replace(/^(.*?)(?:\.md)?(#.*?)?$/, '$1.html$2');
						}
						const linkNode = createEl('a', { text: href, cls: className, href: htmlHref });
						linkEl.replaceWith(linkNode);
					}
						break;

					case InternalLinkHandling.CONVERT_TO_TEXT:
					default: {
						const textNode = createEl('span', { text, cls: className });
						linkEl.replaceWith(textNode);
					}
						break;
				}
			});
	}

	private makeCheckboxesReadOnly(node: HTMLElement) {
		node.querySelectorAll('input[type="checkbox"]')
			.forEach(node => node.setAttribute('disabled', 'disabled'));
	}

	/** Remove the collapse indicators from HTML, not needed (and not working) in copy */
	private removeCollapseIndicators(node: HTMLElement) {
		node.querySelectorAll('.collapse-indicator')
			.forEach(node => node.remove());
	}

	/** Remove button elements (which appear after code blocks) */
	private removeButtons(node: HTMLElement) {
		node.querySelectorAll('button')
			.forEach(node => node.remove());
	}

	/** Remove counters added by Strange New Worlds plugin (https://github.com/TfTHacker/obsidian42-strange-new-worlds) */
	private removeStrangeNewWorldsLinks(node: HTMLElement) {
		node.querySelectorAll('.snw-reference')
			.forEach(node => node.remove());
	}

	/** Transform code blocks to tables */
	private transformCodeToTables(node: HTMLElement) {
		node.querySelectorAll('pre')
			.forEach(preEl => {
				const table = createEl('table', { cls: 'source-table' });
				const bg = this.options.codeBlockBackground ? '#f5f5f5' : 'transparent';
				table.setCssStyles({ backgroundColor: bg });
				const tr = table.createEl('tr');
				const td = tr.createEl('td');
				td.setCssStyles({ backgroundColor: bg });
				const newPre = td.createEl('pre');
				newPre.setCssStyles({ backgroundColor: 'transparent' });

				const sourceEl = preEl.querySelector('code') ?? preEl;
				while (sourceEl.firstChild) {
					newPre.appendChild(sourceEl.firstChild);
				}
				preEl.replaceWith(table);
			});
	}

	/** Transform callouts to tables */
	private transformCalloutsToTables(node: HTMLElement) {
		node.querySelectorAll('.callout')
			.forEach(calloutEl => {
				const callout = createEl('table', { cls: 'callout-table callout' });
				callout.setAttribute('data-callout', calloutEl.getAttribute('data-callout') ?? 'quote');
				const headRow = callout.createEl('tr');
				const headColumn = headRow.createEl('td', { cls: 'callout-title' });
				const title = calloutEl.querySelector('.callout-title-inner');

				if (title) {
					const span = headColumn.createEl('span');
					while (title.firstChild) {
						span.appendChild(title.firstChild);
					}
				}

				const originalContent = calloutEl.querySelector('.callout-content');
				if (originalContent) {
					const row = callout.createEl('tr');
					const column = row.createEl('td');
					while (originalContent.firstChild) {
						column.appendChild(originalContent.firstChild);
					}
				}

				calloutEl.replaceWith(callout);
			});
	}

	/** Remove references to footnotes and the footnotes section */
	private removeAllFootnotes(node: HTMLElement) {
		node.querySelectorAll('section.footnotes')
			.forEach(section => section.parentNode!.removeChild(section));

		node.querySelectorAll('.footnote-link')
			.forEach(link => {
				link.parentNode!.parentNode!.removeChild(link.parentNode!);
			});
	}

	/** Keep footnotes and references, but remove links */
	private removeFootnoteLinks(node: HTMLElement) {
		node.querySelectorAll('.footnote-link')
			.forEach(link => {
				const text = link.getText();
				if (text === '↩︎') {
					// remove back-link
					link.parentNode!.removeChild(link);
				} else {
					// remove from reference
					const span = link.parentNode!.createEl('span', {text: link.getText(), cls: 'footnote-link'})
					link.parentNode!.replaceChild(span, link);
				}
			});
	}

	/** Replace all images sources with a data-uri */
	private async embedImages(node: HTMLElement): Promise<HTMLElement> {
		const promises: Promise<void>[] = [];

		// Replace all image sources
		node.querySelectorAll('img')
			.forEach(img => {
				if (img.src) {
					if (img.src.startsWith('data:image/svg+xml') && this.options.convertSvgToBitmap) {
						// image is an SVG, encoded as a data uri. This is the case with Excalidraw for instance.
						// Convert it to bitmap
						promises.push(this.replaceImageSource(img));
						return;
					}

					if (!this.options.embedExternalLinks) {
						const [scheme] = img.src.split(':', 1);
						if (this.externalSchemes.includes(scheme.toLowerCase())) {
							// don't touch external images
							return;
						} else {
							// not an external image, continue processing below
						}
					}

					if (!img.src.startsWith('data:')) {
						// render bitmaps, except if already as data-uri
						promises.push(this.replaceImageSource(img));
						return;
					}
				}
			});

		// @ts-ignore
		this.modal.progress.max = 100;

		// @ts-ignore
		await allWithProgress(promises, percentCompleted => this.modal.progress.value = percentCompleted);
		return node;
	}

	private async renderSvg(node: HTMLElement): Promise<Element> {
		const xmlSerializer = new XMLSerializer();

		if (!this.options.convertSvgToBitmap) {
			return node;
		}

		const promises: Promise<void>[] = [];

		const replaceSvg = async (svg: SVGSVGElement) => {
			let svgAsString = xmlSerializer.serializeToString(svg);
			if (MERMAID_STYLESHEET && !svgAsString.includes('<style')) {
				svgAsString = svgAsString.replace(/<svg([^>]*)>/, `<svg$1><style>${MERMAID_STYLESHEET}</style>`);
			}

			const svgData = `data:image/svg+xml;base64,` + Buffer.from(svgAsString).toString('base64');
			const dataUri = await this.imageToDataUri(svgData);

			const img = createEl('img');
			if (svg.getAttribute('style')) {
				img.setAttribute('style', svg.getAttribute('style') || '');
			}
			img.src = dataUri;

			svg.replaceWith(img);
		};

		node.querySelectorAll('svg')
			.forEach(svg => {
				if (svg.closest('.katex, .math, math, .math-block')) {
					return;
				}
				promises.push(replaceSvg(svg));
			});

		// @ts-ignore
		this.modal.progress.max = 0;

		// @ts-ignore
		await allWithProgress(promises, percentCompleted => this.modal.progress.value = percentCompleted);
		return node;
	}

	/** replace image src attribute with data uri */
	private async replaceImageSource(image: HTMLImageElement): Promise<void> {
		const imageSourcePath = decodeURI(image.src);

		if (imageSourcePath.startsWith(this.vaultLocalUriPrefix)) {
			// Transform uri to Obsidian relative path
			let path = imageSourcePath.substring(this.vaultLocalUriPrefix.length + 1)
				.replace(/[?#].*/, '');
			path = decodeURI(path);

			const mimeType = this.guessMimeType(path);
			const data = await this.readFromVault(path, mimeType);

			if (this.isSvg(mimeType) && this.options.convertSvgToBitmap) {
				// render svg to bitmap for compatibility w/ for instance gmail
				image.src = await this.imageToDataUri(data);
			} else {
				// file content as base64 data uri (including svg)
				image.src = data;
			}
		} else {
			// Attempt to render uri to canvas. This is not an uri that points to the vault. Not needed for public
			// urls, but we may have un uri that points to our local machine or network, that will not be accessible
			// wherever we intend to paste the document.
			image.src = await this.imageToDataUri(image.src);
		}
	}

	/**
	 * Draw image url to canvas and return as data uri containing image pixel data
	 */
	private async imageToDataUri(url: string): Promise<string> {
		const canvas = createEl('canvas');
		const ctx = canvas.getContext('2d');

		const image = new Image();
		image.setAttribute('crossOrigin', 'anonymous');

		const dataUriPromise = new Promise<string>((resolve, reject) => {
			image.onload = () => {
				canvas.width = image.naturalWidth;
				canvas.height = image.naturalHeight;

				ctx?.drawImage(image, 0, 0);

				try {
					const uri = canvas.toDataURL('image/png');
					resolve(uri);
				} catch {
					// If we fail, leave the original url
					resolve(url);
				}

				canvas.remove();
			}

			image.onerror = () => {
				// If we fail, leave the original url
				resolve(url);
			}
		})

		image.src = url;

		return dataUriPromise;
	}

	/**
	 * Get binary data as b64 from a file in the vault
	 */
	private async readFromVault(path: string, mimeType: string): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return '';
		}
		const data = await this.app.vault.readBinary(file);
		return `data:${mimeType};base64,` + arrayBufferToBase64(data);
	}

	/** Guess an image's mime-type based on its extension */
	private guessMimeType(filePath: string): string {
		const extension = this.getExtension(filePath) || 'png';
		return this.mimeMap.get(extension) || `image/${extension}`;
	}

	/** Get lower-case extension for a path */
	private getExtension(filePath: string): string {
		// avoid using the "path" library
		const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
		return fileName.slice(fileName.lastIndexOf('.') + 1 || fileName.length)
			.toLowerCase();
	}

	private isSvg(mimeType: string): boolean {
		return mimeType === 'image/svg+xml';
	}

	/**
	 * Tokenize math formulas ($...$, $$...$$, and ```math) to protect them from MarkdownRenderer
	 * and store their raw LaTeX for high-fidelity conversion.
	 */
	private tokenizeMath(markdown: string): string {
		const codeBlocks: string[] = [];

		// 1. Protect code blocks and inline code
		let text = markdown.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
			const mathMatch = match.match(/^```math\s*\n([\s\S]*?)\n```$/i);
			if (mathMatch) {
				const id = `copy-math-block-${this.mathItems.size}`;
				this.mathItems.set(id, { tex: mathMatch[1].trim(), isBlock: true });
				return `<span class="copy-math-placeholder" data-math-id="${id}" data-math-block="true"></span>`;
			}
			codeBlocks.push(match);
			return `___COPY_CODE_BLOCK_${codeBlocks.length - 1}___`;
		});

		// 2. Display math: $$...$$
		text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, texContent) => {
			const id = `copy-math-block-${this.mathItems.size}`;
			this.mathItems.set(id, { tex: texContent.trim(), isBlock: true });
			return `\n\n<span class="copy-math-placeholder" data-math-id="${id}" data-math-block="true"></span>\n\n`;
		});

		// 3. Inline math: $...$ (ignoring escaped \$ and currency like $50)
		text = text.replace(/(?<![\w\\])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![0-9a-zA-Z])/g, (match, texContent) => {
			const trimmed = texContent.trim();
			// Skip currency e.g. $50, $100.50
			if (/^[\d,.]+(\s*(million|billion|thousand|k|m|usd|eur|gbp|inr))?$/i.test(trimmed)) {
				return match;
			}
			if (/^\d/.test(trimmed) && !/[\\^_{}=+\-*/<>≈≠≤≥∑∫∏√α-ωΑ-Ω]/.test(trimmed)) {
				return match;
			}
			if (!trimmed.includes('\\') && /\b(and|or|for|the|in|is|of|to|with|by|from|at|on)\b/i.test(trimmed)) {
				return match;
			}

			const id = `copy-math-inline-${this.mathItems.size}`;
			this.mathItems.set(id, { tex: trimmed, isBlock: false });
			return `<span class="copy-math-placeholder" data-math-id="${id}" data-math-block="false"></span>`;
		});

		// 4. Restore code blocks safely
		for (let i = 0; i < codeBlocks.length; i++) {
			text = text.split(`___COPY_CODE_BLOCK_${i}___`).join(codeBlocks[i]);
		}

		return text;
	}

	private replaceElementWithHtml(target: Element, htmlString: string): void {
		const doc = new DOMParser().parseFromString(htmlString, 'text/html');
		const frag = document.createDocumentFragment();
		while (doc.body.firstChild) {
			frag.appendChild(doc.body.firstChild);
		}
		target.replaceWith(frag);
	}

	/**
	 * Replaces all math placeholders and any remaining math elements with rendered MathML or KaTeX HTML.
	 */
	private renderMathElements(node: HTMLElement): void {
		// 1. Replace all tokenized placeholders
		node.querySelectorAll('.copy-math-placeholder').forEach((placeholder) => {
			const id = placeholder.getAttribute('data-math-id');
			const item = id ? this.mathItems.get(id) : null;
			if (item) {
				const rendered = this.renderMathFormula(item.tex, item.isBlock);
				const parent = placeholder.parentElement;
				if (item.isBlock && parent && parent.tagName === 'P' && parent.childNodes.length === 1) {
					this.replaceElementWithHtml(parent, rendered);
				} else {
					this.replaceElementWithHtml(placeholder, rendered);
				}
			}
		});

		// 2. Also check any existing .math elements (e.g. from dataview or embeds)
		node.querySelectorAll('.math-inline, .math-block').forEach((el) => {
			if (el.closest('.math-block, math')) return;
			const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
			const rawTex = annotation ? annotation.textContent : el.textContent;
			if (rawTex && rawTex.trim()) {
				const isBlock = el.classList.contains('math-block');
				const rendered = this.renderMathFormula(rawTex.trim(), isBlock);
				this.replaceElementWithHtml(el, rendered);
			}
		});
	}

	/**
	 * Render LaTeX formula using KaTeX into MathML or HTML+MathML.
	 */
	private renderMathFormula(tex: string, isBlock: boolean): string {
		try {
			if (this.options.mathHandling === MathHandling.MATHML) {
				let mathml = katex.renderToString(tex, {
					displayMode: isBlock,
					output: 'mathml',
					throwOnError: false
				});
				const match = mathml.match(/<math[\s\S]*<\/math>/i);
				if (match) {
					mathml = match[0];
				}
				if (isBlock) {
					return `<div class="math-block" style="text-align: center; margin: 1em 0;">${mathml}</div>`;
				}
				return mathml;
			} else if (this.options.mathHandling === MathHandling.HTML_MATHML) {
				const html = katex.renderToString(tex, {
					displayMode: isBlock,
					output: 'htmlAndMathml',
					throwOnError: false
				});
				if (isBlock) {
					return `<div class="math-block" style="text-align: center; margin: 1em 0;">${html}</div>`;
				}
				return html;
			}
		} catch (err) {
			console.error('KaTeX rendering error:', err);
		}
		return isBlock ? `<p>$$${tex}$$</p>` : `$${tex}$`;
	}
}

/**
 * Modal to show progress during conversion
 */
class CopyingToHtmlModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	private _progress: HTMLElement;

	get progress() {
		return this._progress;
	}

	onOpen() {
		const {titleEl, contentEl} = this;
		titleEl.setText('Copying to clipboard');
		this._progress = contentEl.createEl('progress', { cls: 'copy-as-html-progress' });
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

/**
 * Settings dialog
 */
class CopyDocumentAsHTMLSettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: CopyDocumentAsHTMLPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl).setName('Copy document as HTML Settings').setHeading();

		new Setting(containerEl).setName('Compatibility').setHeading();

		new Setting(containerEl)
			.setName('Convert SVG files to bitmap')
			.setDesc('If checked, SVG files are converted to bitmap. This makes the copied documents heavier but improves compatibility (eg. with gmail).')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.convertSvgToBitmap)
				.onChange(async (value) => {
					this.plugin.settings.convertSvgToBitmap = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Embed external images')
			.setDesc('If checked, external images are downloaded and embedded. If unchecked, the resulting document may contain links to external resources')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.embedExternalLinks)
				.onChange(async (value) => {
					this.plugin.settings.embedExternalLinks = value;
					await this.plugin.saveSettings();
				}));


		new Setting(containerEl)
			.setName('Render code with tables')
			.setDesc("If checked code blocks are rendered as tables, which makes pasting into Google docs somewhat prettier.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.formatCodeWithTables)
				.onChange(async (value) => {
					this.plugin.settings.formatCodeWithTables = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Code block background color')
			.setDesc("If checked, code blocks will have a shaded background color (#f5f5f5). If unchecked (default), the background is transparent.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.codeBlockBackground)
				.onChange(async (value) => {
					this.plugin.settings.codeBlockBackground = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Render callouts with tables')
			.setDesc("If checked callouts are rendered as tables, which makes pasting into Google docs somewhat prettier.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.formatCalloutsWithTables)
				.onChange(async (value) => {
					this.plugin.settings.formatCalloutsWithTables = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-format pasted math from ChatGPT & Web (Ctrl+V)')
			.setDesc("When pasting content from ChatGPT, Claude, Wikipedia, etc., automatically cleans up duplicate math text and formats formulas as proper Obsidian LaTeX ($...$ and $$...$$).")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.cleanPastedMath)
				.onChange(async (value) => {
					this.plugin.settings.cleanPastedMath = value;
					await this.plugin.saveSettings();
				}));


		new Setting(containerEl).setName('Rendering').setHeading();

		new Setting(containerEl)
			.setName('Math formula handling')
			.setDesc(createFragment(frag => {
				frag.appendText('This option controls how math formulas ($...$ and $$...$$) are rendered when copied:');
				const ul = frag.createEl('ul');
				const li1 = ul.createEl('li');
				li1.createEl('b', { text: 'MathML (Recommended)' });
				li1.appendText(': Render as MathML (<math>). Pastes into Microsoft Word, Google Docs, Apple Pages, and LibreOffice as native, editable equations.');
				const li2 = ul.createEl('li');
				li2.createEl('b', { text: 'HTML + MathML (KaTeX)' });
				li2.appendText(': Render as styled HTML with embedded MathML. Best for web apps, Notion, Anki, and Gmail.');
				const li3 = ul.createEl('li');
				li3.createEl('b', { text: 'Leave as raw code' });
				li3.appendText(': Copies raw LaTeX ($...).');
			}))
			.addDropdown(dropdown => dropdown
				.addOption(MathHandling.MATHML, 'MathML (MS Word, Google Docs, LibreOffice)')
				.addOption(MathHandling.HTML_MATHML, 'HTML + MathML (Web, Notion, Anki, Gmail)')
				.addOption(MathHandling.AS_IS, 'Leave as raw code ($...)')
				.setValue(this.plugin.settings.mathHandling)
				.onChange(async (value) => {
					this.plugin.settings.mathHandling = value as MathHandling;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Include filename as header')
			.setDesc("If checked, the filename is inserted as a level 1 header. (only if an entire document is copied)")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.fileNameAsHeader)
				.onChange(async (value) => {
					this.plugin.settings.fileNameAsHeader = value;
					await this.plugin.saveSettings();
				}))

		new Setting(containerEl)
			.setName('Copy HTML fragment only')
			.setDesc("If checked, only generate a HTML fragment and not a full HTML document. This excludes the header, and effectively disables all styling.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.bareHtmlOnly)
				.onChange(async (value) => {
					this.plugin.settings.bareHtmlOnly = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Remove properties / front-matter sections')
			.setDesc("If checked, the YAML content between --- lines at the front of the document are removed. If you don't know what this means, leave it on.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeFrontMatter)
				.onChange(async (value) => {
					this.plugin.settings.removeFrontMatter = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Remove dataview metadata lines')
			.setDesc(createFragment(frag => {
				frag.createEl('p', { text: 'Remove lines that only contain dataview meta-data, eg. "rating:: 9". Metadata between square brackets is left intact.' });
				frag.createEl('p', { text: "Current limitations are that lines starting with a space are not removed, and lines that look like metadata in code blocks are removed if they don't start with a space" });
			}))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeDataviewMetadataLines)
				.onChange(async (value) => {
					this.plugin.settings.removeDataviewMetadataLines = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Footnote handling')
			.setDesc(createFragment(frag => {
				const ul = frag.createEl('ul');
				ul.createEl('li', { text: 'Remove everything: Remove references and links.' });
				ul.createEl('li', { text: "Display only: leave reference and foot-note, but don't display as a link." });
				ul.createEl('li', { text: 'Display and link: attempt to link the reference to the footnote, may not work depending on paste target.' });
			}))
			.addDropdown(dropdown => dropdown
				.addOption(FootnoteHandling.REMOVE_ALL.toString(), 'Remove everything')
				.addOption(FootnoteHandling.REMOVE_LINK.toString(), 'Display only')
				.addOption(FootnoteHandling.LEAVE_LINK.toString(), 'Display and link')
				.setValue(this.plugin.settings.footnoteHandling.toString())
				.onChange(async (value) => {
					switch (value) {
						case FootnoteHandling.TITLE_ATTRIBUTE.toString():
							this.plugin.settings.footnoteHandling = FootnoteHandling.TITLE_ATTRIBUTE;
							break;
						case FootnoteHandling.REMOVE_ALL.toString():
							this.plugin.settings.footnoteHandling = FootnoteHandling.REMOVE_ALL;
							break;
						case FootnoteHandling.REMOVE_LINK.toString():
							this.plugin.settings.footnoteHandling = FootnoteHandling.REMOVE_LINK;
							break;
						case FootnoteHandling.LEAVE_LINK.toString():
						default:
							this.plugin.settings.footnoteHandling = FootnoteHandling.LEAVE_LINK;
							break;
					}
					await this.plugin.saveSettings();
				})
			)

		new Setting(containerEl)
			.setName('Link handling')
			.setDesc(createFragment(frag => {
				frag.appendText('This option controls how links to Obsidian documents and tags are handled.');
				const ul = frag.createEl('ul');
				ul.createEl('li', { text: "Don't link: only render the link title" });
				ul.createEl('li', { text: 'Open with Obsidian: convert the link to an obsidian:// URI' });
				ul.createEl('li', { text: 'Link to HTML: keep the link, but convert the extension to .html' });
				ul.createEl('li', { text: 'Leave as is: keep the generated link' });
			}))
			.addDropdown(dropdown => dropdown
				.addOption(InternalLinkHandling.CONVERT_TO_TEXT.toString(), 'Don\'t link')
				.addOption(InternalLinkHandling.CONVERT_TO_OBSIDIAN_URI.toString(), 'Open with Obsidian')
				.addOption(InternalLinkHandling.LINK_TO_HTML.toString(), 'Link to HTML')
				.addOption(InternalLinkHandling.LEAVE_AS_IS.toString(), 'Leave as is')
				.setValue(this.plugin.settings.internalLinkHandling.toString())
				.onChange(async (value) => {
					switch (value) {
						case InternalLinkHandling.CONVERT_TO_OBSIDIAN_URI.toString():
							this.plugin.settings.internalLinkHandling = InternalLinkHandling.CONVERT_TO_OBSIDIAN_URI;
							break;
						case InternalLinkHandling.LINK_TO_HTML.toString():
							this.plugin.settings.internalLinkHandling = InternalLinkHandling.LINK_TO_HTML;
							break;
						case InternalLinkHandling.LEAVE_AS_IS.toString():
							this.plugin.settings.internalLinkHandling = InternalLinkHandling.LEAVE_AS_IS;
							break;
						case InternalLinkHandling.CONVERT_TO_TEXT.toString():
						default:
							this.plugin.settings.internalLinkHandling = InternalLinkHandling.CONVERT_TO_TEXT;
							break;
					}
					await this.plugin.saveSettings();
				})
			)

		new Setting(containerEl).setName('Custom templates (advanced)').setHeading();

		const useCustomStylesheetSetting = new Setting(containerEl)
			.setName('Provide a custom stylesheet')
			.setDesc('The default stylesheet provides minimalistic theming. You may want to customize it for better looks. Disabling this setting will restore the default stylesheet.');

		const customStylesheetSetting = new Setting(containerEl)
			.setClass('customizable-text-setting')
			.addTextArea(textArea => textArea
				.setValue(this.plugin.settings.styleSheet)
				.onChange(async (value) => {
					this.plugin.settings.styleSheet = value;
					await this.plugin.saveSettings();
				}));

		useCustomStylesheetSetting.addToggle(toggle => {
			customStylesheetSetting.settingEl.toggle(this.plugin.settings.useCustomStylesheet);

			toggle
				.setValue(this.plugin.settings.useCustomStylesheet)
				.onChange(async (value) => {
					this.plugin.settings.useCustomStylesheet = value;
					customStylesheetSetting.settingEl.toggle(this.plugin.settings.useCustomStylesheet);
					if (!value) {
						this.plugin.settings.styleSheet = DEFAULT_STYLESHEET;
					}
					await this.plugin.saveSettings();
				});
		});

		const useCustomHtmlTemplateSetting = new Setting(containerEl)
			.setName('Provide a custom HTML template')
			.setDesc(createFragment(frag => {
				frag.appendText('For even more customization, you can provide a custom HTML template. Disabling this setting will restore the default template.');
				frag.createEl('br');
				frag.createEl('br');
				frag.appendText('Note that the template is not used if the "Copy HTML fragment only" setting is enabled.');
			}));

		const customHtmlTemplateSetting = new Setting(containerEl)
			.setDesc(createFragment(frag => {
				frag.appendText('The template should include the following placeholders :');
				const ul = frag.createEl('ul');
				const li1 = ul.createEl('li');
				li1.createEl('code', { text: '${title}' });
				li1.appendText(': the document title');
				const li2 = ul.createEl('li');
				li2.createEl('code', { text: '${stylesheet}' });
				li2.appendText(': the CSS stylesheet. The custom stylesheet will be applied if any is specified');
				const li3 = ul.createEl('li');
				li3.createEl('code', { text: '${MERMAID_STYLESHEET}' });
				li3.appendText(': the CSS for mermaid diagrams');
				const li4 = ul.createEl('li');
				li4.createEl('code', { text: '${body}' });
				li4.appendText(': the document body');
			}))
			.setClass('customizable-text-setting')
			.addTextArea(textArea => textArea
				.setValue(this.plugin.settings.htmlTemplate)
				.onChange(async (value) => {
					this.plugin.settings.htmlTemplate = value;
					await this.plugin.saveSettings();
				}));

		useCustomHtmlTemplateSetting.addToggle(toggle => {
			customHtmlTemplateSetting.settingEl.toggle(this.plugin.settings.useCustomHtmlTemplate);

			toggle
				.setValue(this.plugin.settings.useCustomHtmlTemplate)
				.onChange(async (value) => {
					this.plugin.settings.useCustomHtmlTemplate = value;
					customHtmlTemplateSetting.settingEl.toggle(this.plugin.settings.useCustomHtmlTemplate);
					if (!value) {
						this.plugin.settings.htmlTemplate = DEFAULT_HTML_TEMPLATE;
					}
					await this.plugin.saveSettings();
				});
		});

		new Setting(containerEl).setName('Exotic / Developer options').setHeading();

		new Setting(containerEl)
			.setName("Don't embed images")
			.setDesc(createFragment(frag => {
				frag.appendText('When this option is enabled, images will not be embedded in the HTML document, but ');
				frag.createEl('em', { text: 'broken' });
				frag.appendText(' links will be left in place. This is not recommended.');
			}))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.disableImageEmbedding)
				.onChange(async (value) => {
					this.plugin.settings.disableImageEmbedding = value;
					await this.plugin.saveSettings();
				}));
	}
}

type CopyDocumentAsHTMLSettings = {
	/** Remove front-matter */
	removeFrontMatter: boolean;

	/** If set svg are converted to bitmap */
	convertSvgToBitmap: boolean;

	/** Render code elements as tables */
	formatCodeWithTables: boolean;

	/** Render callouts as tables */
	formatCalloutsWithTables: boolean;

	/** Embed external links (load them and embed their content) */
	embedExternalLinks: boolean;

	/** Remove dataview meta-data lines (format : `some-tag:: value` */
	removeDataviewMetadataLines: boolean;

	/** How are foot-notes displayed ? */
	footnoteHandling: FootnoteHandling;

	/** How are internal links handled ? */
	internalLinkHandling: InternalLinkHandling;

	/** remember if the stylesheet was default or custom */
	useCustomStylesheet: boolean;

	/**
	 * remember if the HTML wrapper was default or custom
	 */
	useCustomHtmlTemplate: boolean;

	/** Style-sheet */
	styleSheet: string;

	/**
	 * HTML wrapper
	 */
	htmlTemplate: string;

	/** Only generate the HTML body, don't include the <head> section */
	bareHtmlOnly: boolean;

	/** Include filename in copy. Only when entire document is copied */
	fileNameAsHeader: boolean;

	/**
	 * Don't replace image links with data: uris. No idea why you would want this, but here you go.
	 */
	disableImageEmbedding: boolean;

	/**
	 * Format to convert math formulas ($...$ and $$...$$) to
	 */
	mathHandling: MathHandling;

	/**
	 * Apply shaded background color to code blocks (#f5f5f5). If false (default), background is transparent.
	 */
	codeBlockBackground: boolean;

	/**
	 * Auto-format pasted math from ChatGPT, Claude, and web pages (Ctrl+V) into proper LaTeX ($...$ and $$...$$)
	 */
	cleanPastedMath: boolean;
}

const DEFAULT_SETTINGS: CopyDocumentAsHTMLSettings = {
	removeFrontMatter: true,
	convertSvgToBitmap: true,
	useCustomStylesheet: false,
	useCustomHtmlTemplate: false,
	embedExternalLinks: false,
	removeDataviewMetadataLines: false,
	formatCodeWithTables: true,
	formatCalloutsWithTables: false,
	footnoteHandling: FootnoteHandling.REMOVE_LINK,
	internalLinkHandling: InternalLinkHandling.CONVERT_TO_TEXT,
	styleSheet: DEFAULT_STYLESHEET,
	htmlTemplate: DEFAULT_HTML_TEMPLATE,
	bareHtmlOnly: false,
	fileNameAsHeader: true,
	disableImageEmbedding: false,
	mathHandling: MathHandling.MATHML,
	codeBlockBackground: false,
	cleanPastedMath: true,
}

export default class CopyDocumentAsHTMLPlugin extends Plugin {
	settings: CopyDocumentAsHTMLSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'smart-copy-as-html',
			name: 'Copy selection or document to clipboard',
			checkCallback: this.buildCheckCallback(
				view => { void this.copyFromView(view, view.editor.somethingSelected()); })
		});

		this.addCommand({
			id: 'copy-as-html',
			name: 'Copy entire document to clipboard',
			checkCallback: this.buildCheckCallback(view => { void this.copyFromView(view, false); })
		});

		this.addCommand({
			id: 'copy-selection-as-html',
			name: 'Copy current selection to clipboard',
			checkCallback: this.buildCheckCallback(view => { void this.copyFromView(view, true); })
		});

		this.addCommand({
			id: 'copy-selection-as-mathml',
			name: 'Copy current selection directly as MathML',
			editorCheckCallback: (checking, editor) => {
				const selection = editor.getSelection();
				if (checking) {
					return Boolean(selection && selection.trim());
				}
				if (selection) {
					const tex = selection.replace(/^\$+|\$+$/g, '').trim();
					const isBlock = selection.includes('$$') || selection.includes('\n');
					try {
						let mathml = katex.renderToString(tex, {
							displayMode: isBlock,
							output: 'mathml',
							throwOnError: false
						});
						const match = mathml.match(/<math[\s\S]*<\/math>/i);
						if (match) mathml = match[0];
						const html = isBlock
							? `<div class="math-block" style="text-align: center; margin: 1em 0;">${mathml}</div>`
							: mathml;
						const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
						const data = new ClipboardItem({
							"text/html": new Blob([fullHtml], { type: "text/html" }),
							"text/plain": new Blob([tex], { type: "text/plain" }),
						});
						void navigator.clipboard.write([data]).then(() => {
							new Notice('Copied selection to clipboard as MathML');
						}).catch((err: unknown) => {
							new Notice(`Failed to copy to clipboard: ${String(err)}`);
						});
					} catch (e) {
						new Notice(`Failed to convert math: ${e}`);
					}
				}
			}
		});

		// Register post-processors that keep track of the blocks being rendered. For explanation,
		// @see DocumentRenderer#untilRendered()

		const beforeAllPostProcessor = this.registerMarkdownPostProcessor(async () => {
			ppIsProcessing = true;
		});
		beforeAllPostProcessor.sortOrder = -10000;

		const afterAllPostProcessor = this.registerMarkdownPostProcessor(async () => {
			ppLastBlockDate = Date.now();
			ppIsProcessing = false;
		});
		afterAllPostProcessor.sortOrder = 10000;

		// Register UI elements
		this.addSettingTab(new CopyDocumentAsHTMLSettingsTab(this.app, this));
		this.setupEditorMenuEntry();

		// Intercept paste events to auto-format math from ChatGPT / Web
		this.registerEvent(
			this.app.workspace.on('editor-paste', (evt: ClipboardEvent, editor: Editor) => {
				if (evt.defaultPrevented) return;
				this.handleEditorPaste(evt, editor);
			})
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// reload it so we may update it in a new release
		if (!this.settings.useCustomStylesheet) {
			this.settings.styleSheet = DEFAULT_STYLESHEET;
		}

		if (!this.settings.useCustomHtmlTemplate) {
			this.settings.htmlTemplate = DEFAULT_HTML_TEMPLATE;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private buildCheckCallback(action: (activeView: MarkdownView) => void) {
		return (checking: boolean): boolean => {
			if (copyIsRunning) {
				return false;
			}

			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) {
				return false;
			}

			if (!checking) {
				action(activeView);
			}

			return true;
		}
	}

	private async copyFromView(activeView: MarkdownView, onlySelected: boolean) {
		if (!activeView.editor) {
			return;
		}

		if (!activeView.file) {
			return;
		}

		const markdown = onlySelected ? activeView.editor.getSelection() : activeView.data;

		const path = activeView.file.path;
		const name = activeView.file.name;
		return this.doCopy(markdown, path, name, !onlySelected);
	}

	private async copyFromFile(file: TAbstractFile) {
		if (!(file instanceof TFile)) {
			return;
		}

		if (file.extension.toLowerCase() !== 'md') {
			return;
		}

		const markdown = await file.vault.cachedRead(file);
		return this.doCopy(markdown, file.path, file.name, true);
	}

	private async doCopy(markdown: string, path: string, name: string, isFullDocument: boolean) {
		const title = name.replace(/\.md$/i, '');

		const copier = new DocumentRenderer(this.app, this.settings);

		try {
			copyIsRunning = true;

			ppLastBlockDate = Date.now();
			ppIsProcessing = true;

			const htmlBody = await copier.renderDocument(markdown, path);

			if (this.settings.fileNameAsHeader && isFullDocument) {
				const h1 = createEl('h1', { text: title });
				htmlBody.insertBefore(h1, htmlBody.firstChild);
			}

			const htmlDocument = this.settings.bareHtmlOnly
				? htmlBody.outerHTML
				: this.expandHtmlTemplate(htmlBody.outerHTML, title);

			const data =
				new ClipboardItem({
					"text/html": new Blob([htmlDocument], {
						// @ts-ignore
						type: ["text/html", 'text/plain']
					}),
					"text/plain": new Blob([htmlDocument], {
						type: "text/plain"
					}),
				});

			await navigator.clipboard.write([data]);
			new Notice(`Copied to clipboard as HTML`);
		} catch (error) {
			new Notice(`copy failed: ${error}`);
			console.error('copy failed', error);
		} finally {
			copyIsRunning = false;
		}
	}

	private expandHtmlTemplate(html: string, title: string) {
		const template = this.settings.useCustomHtmlTemplate
			? this.settings.htmlTemplate
			: DEFAULT_HTML_TEMPLATE;

		let stylesheet = this.settings.styleSheet;
		const codeBg = this.settings.codeBlockBackground ? '#f5f5f5' : 'transparent';
		stylesheet += `\n.source-table, .source-table td { background-color: ${codeBg} !important; }\npre { background-color: ${codeBg} !important; }\n`;

		return template
			.replace('${title}', title)
			.replace('${body}', html)
			.replace('${stylesheet}', stylesheet)
			.replace('${MERMAID_STYLESHEET}', MERMAID_STYLESHEET);
	}

	private setupEditorMenuEntry() {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, view) => {
				menu.addItem((item) => {
					item
						.setTitle("Copy as HTML")
						.setIcon("clipboard-copy")
						.onClick(async () => {
							return this.copyFromFile(file);
						});
				});
			})
		);
	}

	/**
	 * Automatically clean up math copied from ChatGPT, Claude, Wikipedia, etc. on Ctrl+V
	 */
	private handleEditorPaste(evt: ClipboardEvent, editor: Editor): void {
		if (evt.defaultPrevented || !this.settings.cleanPastedMath) return;
		const clipboardData = evt.clipboardData;
		if (!clipboardData) return;

		const html = clipboardData.getData('text/html');
		const plain = clipboardData.getData('text/plain');

		const hasMath = Boolean(html && (
			html.includes('katex') ||
			html.includes('math-mathml') ||
			html.includes('<math') ||
			html.includes('MathJax') ||
			html.includes('mjx-container')
		));

		if (hasMath && html) {
			try {
				const parser = new DOMParser();
				const doc = parser.parseFromString(html, 'text/html');

				// 1. Process block/display math first: .katex-display
				doc.querySelectorAll('.katex-display').forEach(displayEl => {
					const annotation = displayEl.querySelector('annotation[encoding="application/x-tex"]') || displayEl.querySelector('annotation');
					const tex = annotation ? annotation.textContent?.trim() : '';
					if (tex) {
						const textNode = doc.createTextNode(`\n\n$$${tex}$$\n\n`);
						displayEl.replaceWith(textNode);
					}
				});

				// 2. Process inline math: .katex
				doc.querySelectorAll('.katex').forEach(katexEl => {
					if (!katexEl.isConnected) return;
					const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]') || katexEl.querySelector('annotation');
					const tex = annotation ? annotation.textContent?.trim() : '';
					if (tex) {
						const textNode = doc.createTextNode(`$${tex}$`);
						katexEl.replaceWith(textNode);
					}
				});

				// 3. Process MathJax display
				doc.querySelectorAll('mjx-container[display="true"], .MathJax_Display').forEach(mjxEl => {
					const annotation = mjxEl.querySelector('annotation[encoding="application/x-tex"]') || mjxEl.querySelector('annotation');
					const tex = (annotation ? annotation.textContent?.trim() : mjxEl.getAttribute('data-tex') || mjxEl.getAttribute('aria-label')) || '';
					if (tex) {
						const textNode = doc.createTextNode(`\n\n$$${tex}$$\n\n`);
						mjxEl.replaceWith(textNode);
					}
				});

				// 4. Process MathJax inline
				doc.querySelectorAll('mjx-container, .MathJax').forEach(mjxEl => {
					if (!mjxEl.isConnected) return;
					const annotation = mjxEl.querySelector('annotation[encoding="application/x-tex"]') || mjxEl.querySelector('annotation');
					const tex = (annotation ? annotation.textContent?.trim() : mjxEl.getAttribute('data-tex') || mjxEl.getAttribute('aria-label')) || '';
					if (tex) {
						const textNode = doc.createTextNode(`$${tex}$`);
						mjxEl.replaceWith(textNode);
					}
				});

				// 5. Generic <math> elements
				doc.querySelectorAll('math').forEach(mathEl => {
					if (!mathEl.isConnected) return;
					const annotation = mathEl.querySelector('annotation[encoding="application/x-tex"]') || mathEl.querySelector('annotation');
					const tex = annotation ? annotation.textContent?.trim() : '';
					if (tex) {
						const isBlock = mathEl.getAttribute('display') === 'block';
						const textNode = doc.createTextNode(isBlock ? `\n\n$$${tex}$$\n\n` : `$${tex}$`);
						mathEl.replaceWith(textNode);
					}
				});

				let markdown = htmlToMarkdown(doc.body);

				// Clean up LaTeX shorthand brackets \[...\] and \(...\) if any remain
				markdown = markdown.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => `\n\n$$${formula.trim()}$$\n\n`);
				markdown = markdown.replace(/\\\(([\s\S]*?)\\\)/g, (match, formula) => `$${formula.trim()}$`);

				// Normalize excessive newlines around math blocks
				markdown = markdown.replace(/\n{3,}/g, '\n\n');

				evt.preventDefault();
				editor.replaceSelection(markdown);
				return;
			} catch (err) {
				console.error('Failed to parse pasted math from HTML:', err);
			}
		}

		// Handle plain text with LaTeX shorthand brackets \[...\] or \(...\)
		if (plain && (plain.includes('\\[') || plain.includes('\\('))) {
			let cleaned = plain.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => `\n\n$$${formula.trim()}$$\n\n`);
			cleaned = cleaned.replace(/\\\(([\s\S]*?)\\\)/g, (match, formula) => `$${formula.trim()}$`);
			cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
			evt.preventDefault();
			editor.replaceSelection(cleaned);
		}
	}
}
