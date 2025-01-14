"use strict"

function _encode(ch: string): string {
	return (
		"%" +
		ch
			.charCodeAt(0)
			.toString(16)
			.toUpperCase()
	)
}

// see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
function encodeURIComponent2(str: string): string {
	return encodeURIComponent(str).replace(/[!'()*]/g, _encode)
}

function encodeNoop(str: string): string {
	return str
}

/**
 * Uniform Resource Identifier (URI) http://tools.ietf.org/html/rfc3986.
 * This class is a simple parser which creates the basic component paths
 * (http://tools.ietf.org/html/rfc3986#section-3) with minimal validation
 * and encoding.
 *
 *       foo://example.com:8042/over/there?name=ferret#nose
 *       \_/   \______________/\_________/ \_________/ \__/
 *        |           |            |            |        |
 *     scheme     authority       path        query   fragment
 *        |   _____________________|__
 *       / \ /                        \
 *       urn:example:animal:ferret:nose
 *
 *
 */
export default class URI {
	/**
	 * scheme is the 'http' part of 'http://www.msft.com/some/path?query#fragment'.
	 * The part before the first colon.
	 */
	get scheme() {
		return this._scheme
	}

	/**
	 * authority is the 'www.msft.com' part of 'http://www.msft.com/some/path?query#fragment'.
	 * The part between the first double slashes and the next slash.
	 */
	get authority() {
		return this._authority
	}

	/**
	 * path is the '/some/path' part of 'http://www.msft.com/some/path?query#fragment'.
	 */
	get path() {
		return this._path
	}

	/**
	 * query is the 'query' part of 'http://www.msft.com/some/path?query#fragment'.
	 */
	get query() {
		return this._query
	}

	/**
	 * fragment is the 'fragment' part of 'http://www.msft.com/some/path?query#fragment'.
	 */
	get fragment() {
		return this._fragment
	}

	// ---- filesystem path -----------------------

	/**
	 * Returns a string representing the corresponding file system path of this URI.
	 * Will handle UNC paths and normalize windows drive letters to lower-case. Also
	 * uses the platform specific path separator. Will *not* validate the path for
	 * invalid characters and semantics. Will *not* look at the scheme of this URI.
	 */
	get fsPath() {
		if (!this._fsPath) {
			let value: string
			if (this._authority && this.scheme === "file") {
				// unc path: file://shares/c$/far/boo
				value = `//${this._authority}${this._path}`
			} else if (URI.driveLetterPath.test(this._path)) {
				// windows drive letter: file:///c:/far/boo
				value = this._path[1].toLowerCase() + this._path.substr(2)
			} else {
				// other path
				value = this._path
			}
			if (process.platform === "win32") {
				value = value.replace(/\//g, "\\")
			}
			this._fsPath = value
		}
		return this._fsPath
	}

	// ---- parse & validate ------------------------

	static parse(value: string): URI {
		const ret = new URI()
		const data = URI._parseComponents(value)
		ret._scheme = data.scheme
		ret._authority = decodeURIComponent(data.authority)
		ret._path = decodeURIComponent(data.path)
		ret._query = decodeURIComponent(data.query)
		ret._fragment = decodeURIComponent(data.fragment)
		URI._validate(ret)
		return ret
	}

	static file(path: string): URI {
		const ret = new URI()
		ret._scheme = "file"

		// normalize to fwd-slashes
		path = path.replace(/\\/g, URI.slash)

		// check for authority as used in UNC shares
		// or use the path as given
		if (path[0] === URI.slash && path[0] === path[1]) {
			const idx = path.indexOf(URI.slash, 2)
			if (idx === -1) {
				ret._authority = path.substring(2)
			} else {
				ret._authority = path.substring(2, idx)
				ret._path = path.substring(idx)
			}
		} else {
			ret._path = path
		}

		// Ensure that path starts with a slash
		// or that it is at least a slash
		if (ret._path[0] !== URI.slash) {
			ret._path = URI.slash + ret._path
		}

		URI._validate(ret)

		return ret
	}

	static create(
		scheme?: string,
		authority?: string,
		path?: string,
		query?: string,
		fragment?: string
	): URI {
		return new URI().with(scheme, authority, path, query, fragment)
	}
	private static empty = ""
	private static slash = "/"
	private static regexp = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/
	private static driveLetterPath = /^\/[a-zA-z]:/
	private static upperCaseDrive = /^(\/)?([A-Z]:)/

	private static _parseComponents(value: string): UriComponents {
		const ret: UriComponents = {
			scheme: URI.empty,
			authority: URI.empty,
			path: URI.empty,
			query: URI.empty,
			fragment: URI.empty
		}

		const match = URI.regexp.exec(value)
		if (match) {
			ret.scheme = match[2] || ret.scheme
			ret.authority = match[4] || ret.authority
			ret.path = match[5] || ret.path
			ret.query = match[7] || ret.query
			ret.fragment = match[9] || ret.fragment
		}
		return ret
	}

	private static _validate(ret: URI): void {
		// validation
		// path, http://tools.ietf.org/html/rfc3986#section-3.3
		// If a URI contains an authority component, then the path component
		// must either be empty or begin with a slash ("/") character.  If a URI
		// does not contain an authority component, then the path cannot begin
		// with two slash characters ("//").
		if (ret.authority && ret.path && ret.path[0] !== "/") {
			throw new Error(
				'[UriError]: If a URI contains an authority component, then the path component must either be empty or begin with a slash ("/") character'
			)
		}
		if (!ret.authority && ret.path.indexOf("//") === 0) {
			throw new Error(
				'[UriError]: If a URI does not contain an authority component, then the path cannot begin with two slash characters ("//")'
			)
		}
	}

	private static _asFormatted(uri: URI, skipEncoding: boolean): string {
		const encoder = !skipEncoding ? encodeURIComponent2 : encodeNoop

		const parts: string[] = []

		const { scheme, query, fragment } = uri
		let { authority, path } = uri
		if (scheme) {
			parts.push(scheme, ":")
		}
		if (authority || scheme === "file") {
			parts.push("//")
		}
		if (authority) {
			authority = authority.toLowerCase()
			const idx = authority.indexOf(":")
			if (idx === -1) {
				parts.push(encoder(authority))
			} else {
				parts.push(
					encoder(authority.substr(0, idx)),
					authority.substr(idx)
				)
			}
		}
		if (path) {
			// lower-case windown drive letters in /C:/fff
			const m = URI.upperCaseDrive.exec(path)
			if (m) {
				path =
					m[1] +
					m[2].toLowerCase() +
					path.substr(m[1].length + m[2].length)
			}

			// encode every segement but not slashes
			// make sure that # and ? are always encoded
			// when occurring in paths - otherwise the result
			// cannot be parsed back again
			let lastIdx = 0
			while (true) {
				const idx = path.indexOf(URI.slash, lastIdx)
				if (idx === -1) {
					parts.push(
						encoder(path.substring(lastIdx)).replace(
							/[#?]/,
							_encode
						)
					)
					break
				}
				parts.push(
					encoder(path.substring(lastIdx, idx)).replace(
						/[#?]/,
						_encode
					),
					URI.slash
				)
				lastIdx = idx + 1
			}
		}
		if (query) {
			parts.push("?", encoder(query))
		}
		if (fragment) {
			parts.push("#", encoder(fragment))
		}

		return parts.join(URI.empty)
	}

	/* tslint:disable: variable-name */
	private _scheme: string
	private _authority: string
	private _path: string
	private _query: string
	private _fragment: string
	private _formatted: string
	private _fsPath: string
	/* tslint:enable: variable-name */

	constructor() {
		this._scheme = URI.empty
		this._authority = URI.empty
		this._path = URI.empty
		this._query = URI.empty
		this._fragment = URI.empty

		this._formatted = null
		this._fsPath = null
	}

	// ---- modify to new -------------------------

	with(
		scheme: string,
		authority: string,
		path: string,
		query: string,
		fragment: string
	): URI {
		const ret = new URI()
		ret._scheme = scheme || this.scheme
		ret._authority = authority || this.authority
		ret._path = path || this.path
		ret._query = query || this.query
		ret._fragment = fragment || this.fragment
		URI._validate(ret)
		return ret
	}

	withScheme(value: string): URI {
		return this.with(value, undefined, undefined, undefined, undefined)
	}

	withAuthority(value: string): URI {
		return this.with(undefined, value, undefined, undefined, undefined)
	}

	withPath(value: string): URI {
		return this.with(undefined, undefined, value, undefined, undefined)
	}

	withQuery(value: string): URI {
		return this.with(undefined, undefined, undefined, value, undefined)
	}

	withFragment(value: string): URI {
		return this.with(undefined, undefined, undefined, undefined, value)
	}

	// ---- printing/externalize ---------------------------

	/**
	 *
	 * @param skipEncoding Do not encode the result, default is `false`
	 */
	toString(skipEncoding: boolean = false): string {
		if (!skipEncoding) {
			if (!this._formatted) {
				this._formatted = URI._asFormatted(this, false)
			}
			return this._formatted
		} else {
			// we don't cache that
			return URI._asFormatted(this, true)
		}
	}

	toJSON(): UriState {
		return {
			scheme: this.scheme,
			authority: this.authority,
			path: this.path,
			fsPath: this.fsPath,
			query: this.query,
			fragment: this.fragment,
			external: this.toString(),
			$mid: 1
		}
	}
}

interface UriComponents {
	scheme: string
	authority: string
	path: string
	query: string
	fragment: string
}

interface UriState extends UriComponents {
	$mid: number
	fsPath: string
	external: string
}
