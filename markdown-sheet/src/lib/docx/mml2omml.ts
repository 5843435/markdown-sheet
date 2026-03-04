// @ts-nocheck
// MML2OMML: MathML to Office Open XML Math converter
// Adapted from mml2omml library - Skip TypeScript checking for this third-party code

// Generated using scripts/write-decode-map.ts
const xmlDecodeTree = /* #__PURE__ */ new Uint16Array(
  // prettier-ignore
  /* #__PURE__ */ '\u0200aglq\t\x15\x18\x1b\u026d\x0f\0\0\x12p;\u4026os;\u4027t;\u403et;\u403cuot;\u4022'
    .split('')
    .map((c) => c.charCodeAt(0))
)

// Unicode space characters for LaTeX spacing commands
const UNICODE_SPACES = {
  EM_SPACE: '\u2003', // 1em space (for \quad)
  THIN_SPACE: '\u2009', // thin space (for \,)
  MEDIUM_SPACE: '\u2005', // medium space (for \:)
  THICK_SPACE: '\u2004', // thick space (for \;)
  ZERO_WIDTH_SPACE: '\u200B' // zero-width space (for empty elements)
}

/**
 * Decode HTML entities in a string to their Unicode equivalents.
 * Handles both numeric (&#xHHHH; and &#DDD;) and named entities.
 */
function decodeHtmlEntities(str) {
  if (!str) return str
  return str
    // Decode hex entities: &#xHHHH;
    .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    // Decode decimal entities: &#DDD;
    .replace(/&#(\d+);/g, (match, dec) => String.fromCodePoint(parseInt(dec, 10)))
    // Common named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

// MathML named space values (approximate em values)
const MATHML_NAMED_SPACES = {
  veryverythinmathspace: 0.056, // 1/18 em
  verythinmathspace: 0.111, // 2/18 em
  thinmathspace: 0.167, // 3/18 em
  mediummathspace: 0.222, // 4/18 em
  thickmathspace: 0.278, // 5/18 em
  verythickmathspace: 0.333, // 6/18 em
  veryverythickmathspace: 0.389 // 7/18 em
}

/**
 * Convert a space value (em, named, etc.) to Unicode space character.
 */
function spaceValueToUnicode(value) {
  if (!value) return ''

  let emValue = 0

  // Check if it's a named space
  if (MATHML_NAMED_SPACES[value] !== undefined) {
    emValue = MATHML_NAMED_SPACES[value]
  } else {
    // Try to parse as numeric value
    const numMatch = value.match(/^(-?[\d.]+)(em|pt|px)?$/)
    if (numMatch) {
      emValue = parseFloat(numMatch[1])
      const unit = numMatch[2] || 'em'
      // Convert pt/px to approximate em (assuming 1em ≈ 10pt)
      if (unit === 'pt') emValue = emValue / 10
      else if (unit === 'px') emValue = emValue / 16
    }
  }

  // Map em value to Unicode space
  if (emValue >= 1.8) {
    return UNICODE_SPACES.EM_SPACE + UNICODE_SPACES.EM_SPACE // \qquad (2em)
  } else if (emValue >= 0.8) {
    return UNICODE_SPACES.EM_SPACE // \quad (1em)
  } else if (emValue >= 0.25) {
    return UNICODE_SPACES.THICK_SPACE // \; (5/18 em ≈ 0.278em)
  } else if (emValue >= 0.19) {
    return UNICODE_SPACES.MEDIUM_SPACE // \: (4/18 em ≈ 0.222em)
  } else if (emValue > 0) {
    return UNICODE_SPACES.THIN_SPACE // \, (3/18 em ≈ 0.167em)
  }

  return ''
}

// Adapted from https://github.com/mathiasbynens/he/blob/36afe179392226cf1b6ccdb16ebbb7a5a844d93a/src/he.js#L106-L134
let _a
const decodeMap = new Map([
  [0, 65533],
  // C1 Unicode control character reference replacements
  [128, 8364],
  [130, 8218],
  [131, 402],
  [132, 8222],
  [133, 8230],
  [134, 8224],
  [135, 8225],
  [136, 710],
  [137, 8240],
  [138, 352],
  [139, 8249],
  [140, 338],
  [142, 381],
  [145, 8216],
  [146, 8217],
  [147, 8220],
  [148, 8221],
  [149, 8226],
  [150, 8211],
  [151, 8212],
  [152, 732],
  [153, 8482],
  [154, 353],
  [155, 8250],
  [156, 339],
  [158, 382],
  [159, 376]
])
/**
 * Polyfill for `String.fromCodePoint`. It is used to create a string from a Unicode code point.
 */
const fromCodePoint =
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, n/no-unsupported-features/es-builtins
  (_a = String.fromCodePoint) !== null && _a !== void 0
    ? _a
    : (codePoint) => {
        let output = ''
        if (codePoint > 65535) {
          codePoint -= 65536
          output += String.fromCharCode(((codePoint >>> 10) & 1023) | 55296)
          codePoint = 56320 | (codePoint & 1023)
        }
        output += String.fromCharCode(codePoint)
        return output
      }
/**
 * Replace the given code point with a replacement character if it is a
 * surrogate or is outside the valid range. Otherwise return the code
 * point unchanged.
 */
function replaceCodePoint(codePoint) {
  let _a
  if ((codePoint >= 55296 && codePoint <= 57343) || codePoint > 1114111) {
    return 65533
  }
  return (_a = decodeMap.get(codePoint)) !== null && _a !== void 0 ? _a : codePoint
}

let CharCodes
;((CharCodes) => {
  CharCodes[(CharCodes.NUM = 35)] = 'NUM'
  CharCodes[(CharCodes.SEMI = 59)] = 'SEMI'
  CharCodes[(CharCodes.EQUALS = 61)] = 'EQUALS'
  CharCodes[(CharCodes.ZERO = 48)] = 'ZERO'
  CharCodes[(CharCodes.NINE = 57)] = 'NINE'
  CharCodes[(CharCodes.LOWER_A = 97)] = 'LOWER_A'
  CharCodes[(CharCodes.LOWER_F = 102)] = 'LOWER_F'
  CharCodes[(CharCodes.LOWER_X = 120)] = 'LOWER_X'
  CharCodes[(CharCodes.LOWER_Z = 122)] = 'LOWER_Z'
  CharCodes[(CharCodes.UPPER_A = 65)] = 'UPPER_A'
  CharCodes[(CharCodes.UPPER_F = 70)] = 'UPPER_F'
  CharCodes[(CharCodes.UPPER_Z = 90)] = 'UPPER_Z'
})(CharCodes || (CharCodes = {}))
/** Bit that needs to be set to convert an upper case ASCII character to lower case */
const TO_LOWER_BIT = 32
let BinTrieFlags
;((BinTrieFlags) => {
  BinTrieFlags[(BinTrieFlags.VALUE_LENGTH = 49152)] = 'VALUE_LENGTH'
  BinTrieFlags[(BinTrieFlags.BRANCH_LENGTH = 16256)] = 'BRANCH_LENGTH'
  BinTrieFlags[(BinTrieFlags.JUMP_TABLE = 127)] = 'JUMP_TABLE'
})(BinTrieFlags || (BinTrieFlags = {}))
function isNumber(code) {
  return code >= CharCodes.ZERO && code <= CharCodes.NINE
}
function isHexadecimalCharacter(code) {
  return (
    (code >= CharCodes.UPPER_A && code <= CharCodes.UPPER_F) ||
    (code >= CharCodes.LOWER_A && code <= CharCodes.LOWER_F)
  )
}
function isAsciiAlphaNumeric(code) {
  return (
    (code >= CharCodes.UPPER_A && code <= CharCodes.UPPER_Z) ||
    (code >= CharCodes.LOWER_A && code <= CharCodes.LOWER_Z) ||
    isNumber(code)
  )
}
/**
 * Checks if the given character is a valid end character for an entity in an attribute.
 *
 * Attribute values that aren't terminated properly aren't parsed, and shouldn't lead to a parser error.
 * See the example in https://html.spec.whatwg.org/multipage/parsing.html#named-character-reference-state
 */
function isEntityInAttributeInvalidEnd(code) {
  return code === CharCodes.EQUALS || isAsciiAlphaNumeric(code)
}
let EntityDecoderState
;((EntityDecoderState) => {
  EntityDecoderState[(EntityDecoderState.EntityStart = 0)] = 'EntityStart'
  EntityDecoderState[(EntityDecoderState.NumericStart = 1)] = 'NumericStart'
  EntityDecoderState[(EntityDecoderState.NumericDecimal = 2)] = 'NumericDecimal'
  EntityDecoderState[(EntityDecoderState.NumericHex = 3)] = 'NumericHex'
  EntityDecoderState[(EntityDecoderState.NamedEntity = 4)] = 'NamedEntity'
})(EntityDecoderState || (EntityDecoderState = {}))
let DecodingMode
;((DecodingMode) => {
  /** Entities in text nodes that can end with any character. */
  DecodingMode[(DecodingMode.Legacy = 0)] = 'Legacy'
  /** Only allow entities terminated with a semicolon. */
  DecodingMode[(DecodingMode.Strict = 1)] = 'Strict'
  /** Entities in attributes have limitations on ending characters. */
  DecodingMode[(DecodingMode.Attribute = 2)] = 'Attribute'
})(DecodingMode || (DecodingMode = {}))
/**
 * Token decoder with support of writing partial entities.
 */
class EntityDecoder {
  constructor(
    /** The tree used to decode entities. */
    decodeTree,
    /**
     * The function that is called when a codepoint is decoded.
     *
     * For multi-byte named entities, this will be called multiple times,
     * with the second codepoint, and the same `consumed` value.
     *
     * @param codepoint The decoded codepoint.
     * @param consumed The number of bytes consumed by the decoder.
     */
    emitCodePoint,
    /** An object that is used to produce errors. */
    errors
  ) {
    this.decodeTree = decodeTree
    this.emitCodePoint = emitCodePoint
    this.errors = errors
    /** The current state of the decoder. */
    this.state = EntityDecoderState.EntityStart
    /** Characters that were consumed while parsing an entity. */
    this.consumed = 1
    /**
     * The result of the entity.
     *
     * Either the result index of a numeric entity, or the codepoint of a
     * numeric entity.
     */
    this.result = 0
    /** The current index in the decode tree. */
    this.treeIndex = 0
    /** The number of characters that were consumed in excess. */
    this.excess = 1
    /** The mode in which the decoder is operating. */
    this.decodeMode = DecodingMode.Strict
  }
  /** Resets the instance to make it reusable. */
  startEntity(decodeMode) {
    this.decodeMode = decodeMode
    this.state = EntityDecoderState.EntityStart
    this.result = 0
    this.treeIndex = 0
    this.excess = 1
    this.consumed = 1
  }
  /**
   * Write an entity to the decoder. This can be called multiple times with partial entities.
   * If the entity is incomplete, the decoder will return -1.
   *
   * Mirrors the implementation of `getDecoder`, but with the ability to stop decoding if the
   * entity is incomplete, and resume when the next string is written.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  write(input, offset) {
    switch (this.state) {
      case EntityDecoderState.EntityStart: {
        if (input.charCodeAt(offset) === CharCodes.NUM) {
          this.state = EntityDecoderState.NumericStart
          this.consumed += 1
          return this.stateNumericStart(input, offset + 1)
        }
        this.state = EntityDecoderState.NamedEntity
        return this.stateNamedEntity(input, offset)
      }
      case EntityDecoderState.NumericStart: {
        return this.stateNumericStart(input, offset)
      }
      case EntityDecoderState.NumericDecimal: {
        return this.stateNumericDecimal(input, offset)
      }
      case EntityDecoderState.NumericHex: {
        return this.stateNumericHex(input, offset)
      }
      case EntityDecoderState.NamedEntity: {
        return this.stateNamedEntity(input, offset)
      }
    }
  }
  /**
   * Switches between the numeric decimal and hexadecimal states.
   *
   * Equivalent to the `Numeric character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericStart(input, offset) {
    if (offset >= input.length) {
      return -1
    }
    if ((input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
      this.state = EntityDecoderState.NumericHex
      this.consumed += 1
      return this.stateNumericHex(input, offset + 1)
    }
    this.state = EntityDecoderState.NumericDecimal
    return this.stateNumericDecimal(input, offset)
  }
  addToNumericResult(input, start, end, base) {
    if (start !== end) {
      const digitCount = end - start
      this.result =
        this.result * base ** digitCount + Number.parseInt(input.substr(start, digitCount), base)
      this.consumed += digitCount
    }
  }
  /**
   * Parses a hexadecimal numeric entity.
   *
   * Equivalent to the `Hexademical character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericHex(input, offset) {
    const startIndex = offset
    while (offset < input.length) {
      const char = input.charCodeAt(offset)
      if (isNumber(char) || isHexadecimalCharacter(char)) {
        offset += 1
      } else {
        this.addToNumericResult(input, startIndex, offset, 16)
        return this.emitNumericEntity(char, 3)
      }
    }
    this.addToNumericResult(input, startIndex, offset, 16)
    return -1
  }
  /**
   * Parses a decimal numeric entity.
   *
   * Equivalent to the `Decimal character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericDecimal(input, offset) {
    const startIndex = offset
    while (offset < input.length) {
      const char = input.charCodeAt(offset)
      if (isNumber(char)) {
        offset += 1
      } else {
        this.addToNumericResult(input, startIndex, offset, 10)
        return this.emitNumericEntity(char, 2)
      }
    }
    this.addToNumericResult(input, startIndex, offset, 10)
    return -1
  }
  /**
   * Validate and emit a numeric entity.
   *
   * Implements the logic from the `Hexademical character reference start
   * state` and `Numeric character reference end state` in the HTML spec.
   *
   * @param lastCp The last code point of the entity. Used to see if the
   *               entity was terminated with a semicolon.
   * @param expectedLength The minimum number of characters that should be
   *                       consumed. Used to validate that at least one digit
   *                       was consumed.
   * @returns The number of characters that were consumed.
   */
  emitNumericEntity(lastCp, expectedLength) {
    let _a
    // Ensure we consumed at least one digit.
    if (this.consumed <= expectedLength) {
      ;(_a = this.errors) === null || _a === void 0
        ? void 0
        : _a.absenceOfDigitsInNumericCharacterReference(this.consumed)
      return 0
    }
    // Figure out if this is a legit end of the entity
    if (lastCp === CharCodes.SEMI) {
      this.consumed += 1
    } else if (this.decodeMode === DecodingMode.Strict) {
      return 0
    }
    this.emitCodePoint(replaceCodePoint(this.result), this.consumed)
    if (this.errors) {
      if (lastCp !== CharCodes.SEMI) {
        this.errors.missingSemicolonAfterCharacterReference()
      }
      this.errors.validateNumericCharacterReference(this.result)
    }
    return this.consumed
  }
  /**
   * Parses a named entity.
   *
   * Equivalent to the `Named character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNamedEntity(input, offset) {
    const { decodeTree } = this
    let current = decodeTree[this.treeIndex]
    // The mask is the number of bytes of the value, including the current byte.
    let valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14
    for (; offset < input.length; offset++, this.excess++) {
      const char = input.charCodeAt(offset)
      this.treeIndex = determineBranch(
        decodeTree,
        current,
        this.treeIndex + Math.max(1, valueLength),
        char
      )
      if (this.treeIndex < 0) {
        return this.result === 0 ||
          // If we are parsing an attribute
          (this.decodeMode === DecodingMode.Attribute &&
            // We shouldn't have consumed any characters after the entity,
            (valueLength === 0 ||
              // And there should be no invalid characters.
              isEntityInAttributeInvalidEnd(char)))
          ? 0
          : this.emitNotTerminatedNamedEntity()
      }
      current = decodeTree[this.treeIndex]
      valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14
      // If the branch is a value, store it and continue
      if (valueLength !== 0) {
        // If the entity is terminated by a semicolon, we are done.
        if (char === CharCodes.SEMI) {
          return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess)
        }
        // If we encounter a non-terminated (legacy) entity while parsing strictly, then ignore it.
        if (this.decodeMode !== DecodingMode.Strict) {
          this.result = this.treeIndex
          this.consumed += this.excess
          this.excess = 0
        }
      }
    }
    return -1
  }
  /**
   * Emit a named entity that was not terminated with a semicolon.
   *
   * @returns The number of characters consumed.
   */
  emitNotTerminatedNamedEntity() {
    let _a
    const { result, decodeTree } = this
    const valueLength = (decodeTree[result] & BinTrieFlags.VALUE_LENGTH) >> 14
    this.emitNamedEntityData(result, valueLength, this.consumed)
    ;(_a = this.errors) === null || _a === void 0
      ? void 0
      : _a.missingSemicolonAfterCharacterReference()
    return this.consumed
  }
  /**
   * Emit a named entity.
   *
   * @param result The index of the entity in the decode tree.
   * @param valueLength The number of bytes in the entity.
   * @param consumed The number of characters consumed.
   *
   * @returns The number of characters consumed.
   */
  emitNamedEntityData(result, valueLength, consumed) {
    const { decodeTree } = this
    this.emitCodePoint(
      valueLength === 1 ? decodeTree[result] & ~BinTrieFlags.VALUE_LENGTH : decodeTree[result + 1],
      consumed
    )
    if (valueLength === 3) {
      // For multi-byte values, we need to emit the second byte.
      this.emitCodePoint(decodeTree[result + 2], consumed)
    }
    return consumed
  }
  /**
   * Signal to the parser that the end of the input was reached.
   *
   * Remaining data will be emitted and relevant errors will be produced.
   *
   * @returns The number of characters consumed.
   */
  end() {
    let _a
    switch (this.state) {
      case EntityDecoderState.NamedEntity: {
        // Emit a named entity if we have one.
        return this.result !== 0 &&
          (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex)
          ? this.emitNotTerminatedNamedEntity()
          : 0
      }
      // Otherwise, emit a numeric entity if we have one.
      case EntityDecoderState.NumericDecimal: {
        return this.emitNumericEntity(0, 2)
      }
      case EntityDecoderState.NumericHex: {
        return this.emitNumericEntity(0, 3)
      }
      case EntityDecoderState.NumericStart: {
        ;(_a = this.errors) === null || _a === void 0
          ? void 0
          : _a.absenceOfDigitsInNumericCharacterReference(this.consumed)
        return 0
      }
      case EntityDecoderState.EntityStart: {
        // Return 0 if we have no entity.
        return 0
      }
    }
  }
}
/**
 * Creates a function that decodes entities in a string.
 *
 * @param decodeTree The decode tree.
 * @returns A function that decodes entities in a string.
 */
function getDecoder(decodeTree) {
  let returnValue = ''
  const decoder = new EntityDecoder(decodeTree, (data) => (returnValue += fromCodePoint(data)))
  return function decodeWithTrie(input, decodeMode) {
    let lastIndex = 0
    let offset = 0
    while ((offset = input.indexOf('&', offset)) >= 0) {
      returnValue += input.slice(lastIndex, offset)
      decoder.startEntity(decodeMode)
      const length = decoder.write(
        input,
        // Skip the "&"
        offset + 1
      )
      if (length < 0) {
        lastIndex = offset + decoder.end()
        break
      }
      lastIndex = offset + length
      // If `length` is 0, skip the current `&` and continue.
      offset = length === 0 ? lastIndex + 1 : lastIndex
    }
    const result = returnValue + input.slice(lastIndex)
    // Make sure we don't keep a reference to the final string.
    returnValue = ''
    return result
  }
}
/**
 * Determines the branch of the current node that is taken given the current
 * character. This function is used to traverse the trie.
 *
 * @param decodeTree The trie.
 * @param current The current node.
 * @param nodeIdx The index right after the current node and its value.
 * @param char The current character.
 * @returns The index of the next node, or -1 if no branch is taken.
 */
function determineBranch(decodeTree, current, nodeIndex, char) {
  const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7
  const jumpOffset = current & BinTrieFlags.JUMP_TABLE
  // Case 1: Single branch encoded in jump offset
  if (branchCount === 0) {
    return jumpOffset !== 0 && char === jumpOffset ? nodeIndex : -1
  }
  // Case 2: Multiple branches encoded in jump table
  if (jumpOffset) {
    const value = char - jumpOffset
    return value < 0 || value >= branchCount ? -1 : decodeTree[nodeIndex + value] - 1
  }
  // Case 3: Multiple branches encoded in dictionary
  // Binary search for the character.
  let lo = nodeIndex
  let hi = lo + branchCount - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const midValue = decodeTree[mid]
    if (midValue < char) {
      lo = mid + 1
    } else if (midValue > char) {
      hi = mid - 1
    } else {
      return decodeTree[mid + branchCount]
    }
  }
  return -1
}
const xmlDecoder = /* #__PURE__ */ getDecoder(xmlDecodeTree)
/**
 * Decodes an XML string, requiring all entities to be terminated by a semicolon.
 *
 * @param xmlString The string to decode.
 * @returns The decoded string.
 */
function decodeXML(xmlString) {
  return xmlDecoder(xmlString, DecodingMode.Strict)
}

const attrRE = /\s([^'"/\s><]+?)[\s/>]|([^\s=]+)=\s?(".*?"|'.*?')/g

function stringify$1(tag) {
  const res = {
    type: 'tag',
    name: '',
    voidElement: false,
    attribs: {},
    children: []
  }

  const tagMatch = tag.match(/<\/?([^\s]+?)[/\s>]/)
  if (tagMatch) {
    res.name = tagMatch[1]
    if (tag.charAt(tag.length - 2) === '/') {
      res.voidElement = true
    }

    // handle comment tag
    if (res.name.startsWith('!--')) {
      const endIndex = tag.indexOf('-->')
      return {
        type: 'comment',
        comment: endIndex !== -1 ? tag.slice(4, endIndex) : ''
      }
    }
  }

  const reg = new RegExp(attrRE)
  let result = null
  for (;;) {
    result = reg.exec(tag)

    if (result === null) {
      break
    }

    if (!result[0].trim()) {
      continue
    }

    if (result[1]) {
      const attr = result[1].trim()
      let arr = [attr, '']

      if (attr.indexOf('=') > -1) {
        arr = attr.split('=')
      }

      res.attribs[arr[0]] = arr[1]
      reg.lastIndex--
    } else if (result[2]) {
      res.attribs[result[2]] = result[3].trim().substring(1, result[3].length - 1)
    }
  }

  return res
}

const tagRE = /<[a-zA-Z0-9\-!/](?:"[^"]*"|'[^']*'|[^'">])*>/g
const whitespaceRE = /^\s*$/

const textContainerNames = ['mtext', 'mi', 'mn', 'mo', 'ms']

// re-used obj for quick lookups of components
const empty = Object.create(null)

function parse(html, options) {
  options || (options = {})
  options.components || (options.components = empty)
  const result = []
  const arr = []
  let current
  let level = -1

  html.replace(tagRE, (tag, index) => {
    const isOpen = tag.charAt(1) !== '/'
    const isComment = tag.startsWith('<!--')
    const start = index + tag.length
    const nextChar = html.charAt(start)
    let parent

    if (isComment) {
      const comment = stringify$1(tag)

      // if we're at root, push new base node
      if (level < 0) {
        result.push(comment)
        return result
      }
      parent = arr[level]
      parent.children.push(comment)
      return result
    }

    if (isOpen) {
      level++

      current = stringify$1(tag)
      if (current.type === 'tag' && options.components[current.name]) {
        current.type = 'component'
      }

      if (
        textContainerNames.includes(current.name) &&
        !current.voidElement &&
        nextChar &&
        nextChar !== '<'
      ) {
        const data = html.slice(start, html.indexOf('<', start)).trim()
        current.children.push({
          type: 'text',
          data: options.disableDecode ? data : decodeXML(data)
        })
      }

      // if we're at root, push new base node
      if (level === 0) {
        result.push(current)
      }

      parent = arr[level - 1]

      if (parent) {
        parent.children.push(current)
      }

      arr[level] = current
    }

    if (!isOpen || current.voidElement) {
      if (level > -1 && (current.voidElement || current.name === tag.slice(2, -1))) {
        level--
        // move current up a level to match the end tag
        current = level === -1 ? result : arr[level]
      }
      if (
        level > -1 &&
        textContainerNames.includes[arr[level].name] &&
        nextChar !== '<' &&
        nextChar
      ) {
        // trailing text node
        parent = arr[level].children

        // calculate correct end of the content slice in case there's
        // no tag after the text node.
        const end = html.indexOf('<', start)
        let data = html.slice(start, end === -1 ? undefined : end)
        // if a node is nothing but whitespace, collapse it as the spec states:
        // https://www.w3.org/TR/html4/struct/text.html#h-9.1
        if (whitespaceRE.test(data)) {
          data = ' '
        }
        // don't add whitespace-only text nodes if they would be trailing text nodes
        // or if they would be leading whitespace-only text nodes:
        //  * end > -1 indicates this is not a trailing text node
        //  * leading node is when level is -1 and parent has length 0
        if ((end > -1 && level + parent.length >= 0) || data !== ' ') {
          parent.push({
            type: 'text',
            data: options.disableDecode ? data : decodeXML(data)
          })
        }
      }
    }
  })

  return result
}

function attrString(attribs) {
  const buff = []
  for (const key in attribs) {
    buff.push(`${key}="${attribs[key]}"`)
  }
  if (!buff.length) {
    return ''
  }
  return ` ${buff.join(' ')}`
}

function stringify(buff, doc) {
  switch (doc.type) {
    case 'text':
      return buff + doc.data
    case 'tag': {
      const voidElement =
        doc.voidElement || (!doc.children.length && doc.attribs['xml:space'] !== 'preserve')
      buff += `<${doc.name}${doc.attribs ? attrString(doc.attribs) : ''}${voidElement ? '/>' : '>'}`
      if (voidElement) {
        return buff
      }
      return `${buff + doc.children.reduce(stringify, '')}</${doc.name}>`
    }
    case 'comment':
      buff += `<!--${doc.comment}-->`
      return buff
  }
}

function stringifyDoc(doc) {
  return doc.reduce((token, rootEl) => token + stringify('', rootEl), '')
}

function getTextContent(node, trim = true) {
  let returnString = ''
  if (node.type === 'text') {
    let text = node.data.replace(/[\u2062]|[\u200B]/g, '')
    if (trim) {
      text = text.trim()
    }
    returnString += text
  } else if (node.children) {
    node.children.forEach((subNode) => {
      returnString += getTextContent(subNode, trim)
    })
  }
  return returnString
}

const NARY_REGEXP = /^[\u220f-\u2211]|[\u2229-\u2233]|[\u22c0-\u22c3]$/
const GROW_REGEXP = /^\u220f|\u2211|[\u2229-\u222b]|\u222e|\u222f|\u2232|\u2233|[\u22c0-\u22c3]$/

function getNary(node) {
  // Check if node contains only a nary operator.
  const text = getTextContent(node)
  if (NARY_REGEXP.test(text)) {
    return text
  }
  return false
}

function getNaryTarget(naryChar, element, type, subHide = false, supHide = false) {
  const stretchy = element.attribs?.stretchy
  const grow =
    stretchy === 'true' ? '1' : stretchy === 'false' ? '0' : GROW_REGEXP.test(naryChar) ? '1' : '0'
  return {
    type: 'tag',
    name: 'm:nary',
    attribs: {},
    children: [
      {
        type: 'tag',
        name: 'm:naryPr',
        attribs: {},
        children: [
          { type: 'tag', name: 'm:chr', attribs: { 'm:val': naryChar }, children: [] },
          { type: 'tag', name: 'm:limLoc', attribs: { 'm:val': type }, children: [] },
          { type: 'tag', name: 'm:grow', attribs: { 'm:val': grow }, children: [] },
          {
            type: 'tag',
            name: 'm:subHide',
            attribs: { 'm:val': subHide ? 'on' : 'off' },
            children: []
          },
          {
            type: 'tag',
            name: 'm:supHide',
            attribs: { 'm:val': supHide ? 'on' : 'off' },
            children: []
          }
        ]
      }
    ]
  }
}

function addScriptlevel(target, ancestors) {
  const scriptlevel = ancestors.find((ancestor) => ancestor.attribs?.scriptlevel)?.attribs
    ?.scriptlevel
  if (['0', '1', '2'].includes(scriptlevel)) {
    target.children.unshift({
      type: 'tag',
      name: 'm:argPr',
      attribs: {},
      children: [
        {
          type: 'tag',
          name: 'm:scrLvl',
          attribs: { 'm:val': scriptlevel },
          children: []
        }
      ]
    })
  }
}

function math(element, targetParent, previousSibling, nextSibling, ancestors) {
  targetParent.name = 'm:oMath'
  targetParent.attribs = {
    'xmlns:m': 'http://schemas.openxmlformats.org/officeDocument/2006/math',
    'xmlns:w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  }
  targetParent.type = 'tag'
  targetParent.children = []
  return targetParent
}

function semantics(element, targetParent, previousSibling, nextSibling, ancestors) {
  // Ignore as default behavior
  return targetParent
}

function menclose(element, targetParent, previousSibling, nextSibling, ancestors) {
  const type = element.attribs?.notation?.split(' ')[0] || 'longdiv'

  const targetElement = {
    type: 'tag',
    name: 'm:e',
    attribs: {},
    children: []
  }

  if (type === 'longdiv') {
    targetParent.children.push({
      type: 'tag',
      name: 'm:rad',
      attribs: {},
      children: [
        {
          type: 'tag',
          name: 'm:radPr',
          attribs: {},
          children: [{ type: 'tag', name: 'm:degHide', attribs: { 'm:val': 'on' }, children: [] }]
        },
        { type: 'tag', name: 'm:deg', attribs: {}, children: [] },
        targetElement
      ]
    })
  } else {
    const hide = {
      t: { type: 'tag', name: 'm:hideTop', attribs: { 'm:val': 'on' }, children: [] },
      b: { type: 'tag', name: 'm:hideBot', attribs: { 'm:val': 'on' }, children: [] },
      l: { type: 'tag', name: 'm:hideLeft', attribs: { 'm:val': 'on' }, children: [] },
      r: { type: 'tag', name: 'm:hideRight', attribs: { 'm:val': 'on' }, children: [] }
    }
    const borderBoxPr = { type: 'tag', name: 'm:borderBoxPr', attribs: {}, children: [] }

    const containerElement = {
      type: 'tag',
      name: 'm:borderBox',
      attribs: {},
      children: []
    }
    switch (type) {
      case 'actuarial':
      case 'radical':
      case 'box':
        containerElement.children = [targetElement]
        break
      case 'left':
      case 'roundedbox':
        borderBoxPr.children = [hide.t, hide.b, hide.r]
        containerElement.children = [borderBoxPr, targetElement]
        break
      case 'right':
      case 'circle':
        borderBoxPr.children = [hide.t, hide.b, hide.l]
        containerElement.children = [borderBoxPr, targetElement]
        break
      case 'top':
        borderBoxPr.children = [hide.b, hide.l, hide.r]
        containerElement.children = [borderBoxPr, targetElement]
        break
      case 'bottom':
        borderBoxPr.children = [hide.t, hide.l, hide.r]
        containerElement.children = [borderBoxPr, targetElement]
        break
      case 'updiagonalstrike':
        borderBoxPr.children = [
          hide.t,
          hide.b,
          hide.l,
          hide.r,
          { type: 'tag', name: 'm:strikeBLTR', attribs: { 'm:val': 'on' }, children: [] }
        ]
        containerElement.children = [borderBoxPr, targetElement]
        break
      case 'downdiagonalstrike':
        borderBoxPr.children = [
          hide.t,
          hide.b,
          hide.l,
          hide.r,
          { type: 'tag', name: 'm:strikeTLBR', attribs: { 'm:val': 'on' }, children: [] }
        ]
        containerElement.children = [borderBoxPr, targetElement]
        break
      case 'verticalstrike':
        borderBoxPr.children = [
          hide.t,
          hide.b,
          hide.l,
          hide.r,
          { type: 'tag', name: 'm:strikeV', attribs: { 'm:val': 'on' }, children: [] }
        ]
        containerElement.children = [borderBoxPr, targetElement]
        break
      case 'horizontalstrike':
        borderBoxPr.children = [
          hide.t,
          hide.b,
          hide.l,
          hide.r,
          { type: 'tag', name: 'm:strikeH', attribs: { 'm:val': 'on' }, children: [] }
        ]
        containerElement.children = [borderBoxPr, targetElement]
        break
      default:
        borderBoxPr.children = [hide.t, hide.b, hide.l, hide.r]
        containerElement.children = [borderBoxPr, targetElement]
        break
    }
    targetParent.children.push(containerElement)
  }
  return targetElement
}

function mfrac(element, targetParent, previousSibling, nextSibling, ancestors) {
  if (element.children.length !== 2) {
    // treat as mrow
    return targetParent
  }

  const numerator = element.children[0]
  const denumerator = element.children[1]
  const numeratorTarget = {
    name: 'm:num',
    type: 'tag',
    attribs: {},
    children: []
  }
  const denumeratorTarget = {
    name: 'm:den',
    type: 'tag',
    attribs: {},
    children: []
  }
  ancestors = [...ancestors]
  ancestors.unshift(element)
  walker(numerator, numeratorTarget, false, false, ancestors)
  walker(denumerator, denumeratorTarget, false, false, ancestors)
  const fracType = element.attribs?.linethickness === '0' ? 'noBar' : 'bar'
  targetParent.children.push({
    type: 'tag',
    name: 'm:f',
    attribs: {},
    children: [
      {
        type: 'tag',
        name: 'm:fPr',
        attribs: {},
        children: [
          {
            type: 'tag',
            name: 'm:type',
            attribs: {
              'm:val': fracType
            },
            children: []
          }
        ]
      },
      numeratorTarget,
      denumeratorTarget
    ]
  })
  // Don't iterate over children in the usual way.
}

function mglyph(element, targetParent, previousSibling, nextSibling, ancestors) {
  // No support in omml. Output alt text.
  if (element.attribs?.alt) {
    targetParent.children.push({
      type: 'text',
      data: element.attribs.alt
    })
  }
}

function mmultiscripts(element, targetParent, previousSibling, nextSibling, ancestors) {
  if (element.children.length === 0) {
    // Don't use
    return
  }

  const base = element.children[0]
  const postSubs = []
  const postSupers = []
  const preSubs = []
  const preSupers = []
  const children = element.children.slice(1)
  let dividerFound = false
  children.forEach((child, index) => {
    if (child.name === 'mprescripts') {
      dividerFound = true
    } else if (child.name !== 'none') {
      if (index % 2) {
        if (dividerFound) {
          preSubs.push(child)
        } else {
          postSupers.push(child)
        }
      } else {
        if (dividerFound) {
          preSupers.push(child)
        } else {
          postSubs.push(child)
        }
      }
    }
  })
  ancestors = [...ancestors]
  ancestors.unshift(element)
  const tempTarget = {
    children: []
  }
  walker(base, tempTarget, false, false, ancestors)
  let topTarget = tempTarget.children[0]

  if (postSubs.length || postSupers.length) {
    const subscriptTarget = {
      name: 'm:sub',
      type: 'tag',
      attribs: {},
      children: []
    }
    postSubs.forEach((subscript) => walker(subscript, subscriptTarget, false, false, ancestors))

    const superscriptTarget = {
      name: 'm:sup',
      type: 'tag',
      attribs: {},
      children: []
    }

    postSupers.forEach((superscript) =>
      walker(superscript, superscriptTarget, false, false, ancestors)
    )

    const topPostTarget = {
      type: 'tag',
      attribs: {},
      children: [
        {
          type: 'tag',
          name: 'm:e',
          attribs: {},
          children: [topTarget]
        }
      ]
    }
    if (postSubs.length && postSupers.length) {
      topPostTarget.name = 'm:sSubSup'
      topPostTarget.children.push(subscriptTarget)
      topPostTarget.children.push(superscriptTarget)
    } else if (postSubs.length) {
      topPostTarget.name = 'm:sSub'
      topPostTarget.children.push(subscriptTarget)
    } else {
      topPostTarget.name = 'm:sSup'
      topPostTarget.children.push(superscriptTarget)
    }
    topTarget = topPostTarget
  }

  if (preSubs.length || preSupers.length) {
    const preSubscriptTarget = {
      name: 'm:sub',
      type: 'tag',
      attribs: {},
      children: []
    }
    preSubs.forEach((subscript) => walker(subscript, preSubscriptTarget, false, false, ancestors))

    const preSuperscriptTarget = {
      name: 'm:sup',
      type: 'tag',
      attribs: {},
      children: []
    }

    preSupers.forEach((superscript) =>
      walker(superscript, preSuperscriptTarget, false, false, ancestors)
    )
    const topPreTarget = {
      name: 'm:sPre',
      type: 'tag',
      attribs: {},
      children: [
        {
          name: 'm:e',
          type: 'tag',
          attribs: {},
          children: [topTarget]
        },
        preSubscriptTarget,
        preSuperscriptTarget
      ]
    }
    topTarget = topPreTarget
  }
  targetParent.children.push(topTarget)
  // Don't iterate over children in the usual way.
}

function mrow(element, targetParent, previousSibling, nextSibling, ancestors) {
  if (previousSibling.isNary) {
    const targetSibling = targetParent.children[targetParent.children.length - 1]
    return targetSibling.children[targetSibling.children.length - 1]
  }

  // Check if this is a delimiter group (INNER class with OPEN/CLOSE mo elements)
  // MathJax generates: <mrow data-mjx-texclass="INNER"><mo data-mjx-texclass="OPEN">...</mo>...<mo data-mjx-texclass="CLOSE">...</mo></mrow>
  const texclass = element.attribs?.['data-mjx-texclass']
  if (texclass === 'INNER' && element.children?.length >= 2) {
    const firstChild = element.children[0]
    const lastChild = element.children[element.children.length - 1]

    // Check if first child is OPEN delimiter and last child is CLOSE delimiter
    const isOpenDelimiter =
      firstChild.name === 'mo' && firstChild.attribs?.['data-mjx-texclass'] === 'OPEN'
    const isCloseDelimiter =
      lastChild.name === 'mo' && lastChild.attribs?.['data-mjx-texclass'] === 'CLOSE'

    if (isOpenDelimiter && isCloseDelimiter) {
      // Extract delimiter characters and decode HTML entities
      const openChar = decodeHtmlEntities(getTextContent(firstChild))
      const closeChar = decodeHtmlEntities(getTextContent(lastChild))

      // Create m:d delimiter structure
      const contentTarget = {
        name: 'm:e',
        type: 'tag',
        attribs: {},
        children: []
      }

      const delimElement = {
        name: 'm:d',
        type: 'tag',
        attribs: {},
        children: [
          {
            name: 'm:dPr',
            type: 'tag',
            attribs: {},
            children: [
              {
                name: 'm:begChr',
                type: 'tag',
                attribs: { 'm:val': openChar },
                children: []
              },
              {
                name: 'm:endChr',
                type: 'tag',
                attribs: { 'm:val': closeChar },
                children: []
              }
            ]
          },
          contentTarget
        ]
      }

      targetParent.children.push(delimElement)

      // Process inner children (skip first and last which are the delimiters)
      const innerChildren = element.children.slice(1, -1)
      if (innerChildren.length > 0) {
        ancestors = [...ancestors]
        ancestors.unshift(element)
        for (let i = 0; i < innerChildren.length; i++) {
          walker(
            innerChildren[i],
            contentTarget,
            innerChildren[i - 1],
            innerChildren[i + 1],
            ancestors
          )
        }
      }

      // Return null to prevent default child processing
      return null
    }
  }

  // Check if this is a binomial coefficient pattern (ORD class with nested OPEN/CLOSE mrow elements)
  // MathJax generates for \binom{n}{k}:
  // <mrow data-mjx-texclass="ORD">
  //   <mrow data-mjx-texclass="OPEN"><mo minsize="1.2em" maxsize="1.2em">(</mo></mrow>
  //   <mfrac linethickness="0">...</mfrac>
  //   <mrow data-mjx-texclass="CLOSE"><mo minsize="1.2em" maxsize="1.2em">)</mo></mrow>
  // </mrow>
  if (texclass === 'ORD' && element.children?.length >= 3) {
    const firstChild = element.children[0]
    const lastChild = element.children[element.children.length - 1]

    // Check if first child is mrow with OPEN class containing mo
    const isOpenWrapper =
      firstChild.name === 'mrow' &&
      firstChild.attribs?.['data-mjx-texclass'] === 'OPEN' &&
      firstChild.children?.length === 1 &&
      firstChild.children[0]?.name === 'mo'

    // Check if last child is mrow with CLOSE class containing mo
    const isCloseWrapper =
      lastChild.name === 'mrow' &&
      lastChild.attribs?.['data-mjx-texclass'] === 'CLOSE' &&
      lastChild.children?.length === 1 &&
      lastChild.children[0]?.name === 'mo'

    if (isOpenWrapper && isCloseWrapper) {
      // Extract delimiter characters from the nested mo elements
      const openChar = decodeHtmlEntities(getTextContent(firstChild.children[0]))
      const closeChar = decodeHtmlEntities(getTextContent(lastChild.children[0]))

      // Create m:d delimiter structure
      const contentTarget = {
        name: 'm:e',
        type: 'tag',
        attribs: {},
        children: []
      }

      const delimElement = {
        name: 'm:d',
        type: 'tag',
        attribs: {},
        children: [
          {
            name: 'm:dPr',
            type: 'tag',
            attribs: {},
            children: [
              {
                name: 'm:begChr',
                type: 'tag',
                attribs: { 'm:val': openChar },
                children: []
              },
              {
                name: 'm:endChr',
                type: 'tag',
                attribs: { 'm:val': closeChar },
                children: []
              }
            ]
          },
          contentTarget
        ]
      }

      targetParent.children.push(delimElement)

      // Process inner children (skip first and last which are the delimiter wrappers)
      const innerChildren = element.children.slice(1, -1)
      if (innerChildren.length > 0) {
        ancestors = [...ancestors]
        ancestors.unshift(element)
        for (let i = 0; i < innerChildren.length; i++) {
          walker(
            innerChildren[i],
            contentTarget,
            innerChildren[i - 1],
            innerChildren[i + 1],
            ancestors
          )
        }
      }

      // Return null to prevent default child processing
      return null
    }
  }

  // Check for empty mrow - fill with zero-width space to avoid empty <m:e/>
  if (!element.children || element.children.length === 0) {
    targetParent.children.push({
      name: 'm:r',
      type: 'tag',
      attribs: {},
      children: [
        {
          name: 'm:t',
          type: 'tag',
          attribs: { 'xml:space': 'preserve' },
          children: [{ type: 'text', data: UNICODE_SPACES.ZERO_WIDTH_SPACE }]
        }
      ]
    })
    return null
  }

  // Default behavior - ignore mrow wrapper
  return targetParent
}

function mspace(element, targetParent, previousSibling, nextSibling, ancestors) {
  // Get width attribute and convert to appropriate Unicode space
  const width = element.attribs?.width
  const spaceChar = width ? spaceValueToUnicode(width) : ' '

  // Only add space if there's something to add
  if (spaceChar) {
    targetParent.children.push({
      name: 'm:r',
      type: 'tag',
      attribs: {},
      children: [
        {
          name: 'm:t',
          type: 'tag',
          attribs: {
            'xml:space': 'preserve'
          },
          children: [
            {
              type: 'text',
              data: spaceChar
            }
          ]
        }
      ]
    })
  }
}

function msqrt(element, targetParent, previousSibling, nextSibling, ancestors) {
  const targetElement = {
    name: 'm:e',
    type: 'tag',
    attribs: {},
    children: []
  }
  targetParent.children.push({
    name: 'm:rad',
    type: 'tag',
    attribs: {},
    children: [
      {
        name: 'm:radPr',
        type: 'tag',
        attribs: {},
        children: [
          {
            name: 'm:degHide',
            type: 'tag',
            attribs: {
              'm:val': 'on'
            },
            children: []
          }
        ]
      },
      {
        name: 'm:deg',
        type: 'tag',
        attribs: {},
        children: []
      },
      targetElement
    ]
  })
  return targetElement
}

function mstyle(element, targetParent, previousSibling, nextSibling, ancestors) {
  // Ignore as default behavior
  return targetParent
}

function msub(element, targetParent, previousSibling, nextSibling, ancestors) {
  // Subscript
  if (element.children.length !== 2) {
    // treat as mrow
    return targetParent
  }
  ancestors = [...ancestors]
  ancestors.unshift(element)
  const base = element.children[0]
  const subscript = element.children[1]

  let topTarget
  //
  // m:nAry
  //
  // Conditions:
  // 1. base text must be nary operator
  // 2. no accents
  const naryChar = getNary(base)
  if (
    naryChar &&
    element.attribs?.accent?.toLowerCase() !== 'true' &&
    element.attribs?.accentunder?.toLowerCase() !== 'true'
  ) {
    topTarget = getNaryTarget(naryChar, element, 'subSup', false, true)
    element.isNary = true
  } else {
    const baseTarget = {
      name: 'm:e',
      type: 'tag',
      attribs: {},
      children: []
    }
    walker(base, baseTarget, false, false, ancestors)
    topTarget = {
      type: 'tag',
      name: 'm:sSub',
      attribs: {},
      children: [
        {
          type: 'tag',
          name: 'm:sSubPr',
          attribs: {},
          children: [
            {
              type: 'tag',
              name: 'm:ctrlPr',
              attribs: {},
              children: []
            }
          ]
        },
        baseTarget
      ]
    }
  }

  const subscriptTarget = {
    name: 'm:sub',
    type: 'tag',
    attribs: {},
    children: []
  }

  walker(subscript, subscriptTarget, false, false, ancestors)
  topTarget.children.push(subscriptTarget)
  if (element.isNary) {
    topTarget.children.push({ type: 'tag', name: 'm:sup', attribs: {}, children: [] })
    topTarget.children.push({ type: 'tag', name: 'm:e', attribs: {}, children: [] })
  }
  targetParent.children.push(topTarget)
  // Don't iterate over children in the usual way.
}

function msubsup(element, targetParent, previousSibling, nextSibling, ancestors) {
  // Sub + superscript
  if (element.children.length !== 3) {
    // treat as mrow
    return targetParent
  }

  ancestors = [...ancestors]
  ancestors.unshift(element)

  const base = element.children[0]
  const subscript = element.children[1]
  const superscript = element.children[2]

  let topTarget
  //
  // m:nAry
  //
  // Conditions:
  // 1. base text must be nary operator
  // 2. no accents
  const naryChar = getNary(base)
  if (
    naryChar &&
    element.attribs?.accent?.toLowerCase() !== 'true' &&
    element.attribs?.accentunder?.toLowerCase() !== 'true'
  ) {
    topTarget = getNaryTarget(naryChar, element, 'subSup')
    element.isNary = true
  } else {
    // fallback: m:sSubSup
    const baseTarget = {
      name: 'm:e',
      type: 'tag',
      attribs: {},
      children: []
    }

    walker(base, baseTarget, false, false, ancestors)
    topTarget = {
      type: 'tag',
      name: 'm:sSubSup',
      attribs: {},
      children: [
        {
          type: 'tag',
          name: 'm:sSubSupPr',
          attribs: {},
          children: [
            {
              type: 'tag',
              name: 'm:ctrlPr',
              attribs: {},
              children: []
            }
          ]
        },
        baseTarget
      ]
    }
  }

  const subscriptTarget = {
    name: 'm:sub',
    type: 'tag',
    attribs: {},
    children: []
  }
  const superscriptTarget = {
    name: 'm:sup',
    type: 'tag',
    attribs: {},
    children: []
  }
  walker(subscript, subscriptTarget, false, false, ancestors)
  walker(superscript, superscriptTarget, false, false, ancestors)
  topTarget.children.push(subscriptTarget)
  topTarget.children.push(superscriptTarget)
  if (element.isNary) {
    topTarget.children.push({ type: 'tag', name: 'm:e', attribs: {}, children: [] })
  }
  targetParent.children.push(topTarget)
  // Don't iterate over children in the usual way.
}

function msup(element, targetParent, previousSibling, nextSibling, ancestors) {
  // Superscript
  if (element.children.length !== 2) {
    // treat as mrow
    return targetParent
  }
  ancestors = [...ancestors]
  ancestors.unshift(element)
  const base = element.children[0]
  const superscript = element.children[1]

  let topTarget
  //
  // m:nAry
  //
  // Conditions:
  // 1. base text must be nary operator
  // 2. no accents
  const naryChar = getNary(base)
  if (
    naryChar &&
    element.attribs?.accent?.toLowerCase() !== 'true' &&
    element.attribs?.accentunder?.toLowerCase() !== 'true'
  ) {
    topTarget = getNaryTarget(naryChar, element, 'subSup', true)
    element.isNary = true
    topTarget.children.push({ type: 'tag', name: 'm:sub' })
  } else {
    const baseTarget = {
      name: 'm:e',
      type: 'tag',
      attribs: {},
      children: []
    }
    walker(base, baseTarget, false, false, ancestors)

    topTarget = {
      type: 'tag',
      name: 'm:sSup',
      attribs: {},
      children: [
        {
          type: 'tag',
          name: 'm:sSupPr',
          attribs: {},
          children: [
            {
              type: 'tag',
              name: 'm:ctrlPr',
              attribs: {},
              children: []
            }
          ]
        },
        baseTarget
      ]
    }
  }

  const superscriptTarget = {
    name: 'm:sup',
    type: 'tag',
    attribs: {},
    children: []
  }

  walker(superscript, superscriptTarget, false, false, ancestors)

  topTarget.children.push(superscriptTarget)
  if (element.isNary) {
    topTarget.children.push({ type: 'tag', name: 'm:e', attribs: {}, children: [] })
  }
  targetParent.children.push(topTarget)
  // Don't iterate over children in the usual way.
}

function mtable(element, targetParent, previousSibling, nextSibling, ancestors) {
  const cellsPerRowCount = Math.max(...element.children.map((row) => row.children.length))

  // Get column alignment from columnalign attribute
  // Can be space-separated values like "right left" or "center center center"
  const columnAlignAttr = element.attribs?.columnalign
  let columnAlignments = []
  if (columnAlignAttr) {
    columnAlignments = columnAlignAttr.trim().split(/\s+/)
  }

  // Build m:mcs with proper column alignments
  const mcsChildren = []
  if (columnAlignments.length > 0) {
    // Create individual m:mc for each column with its alignment
    for (let i = 0; i < cellsPerRowCount; i++) {
      // Use the alignment for this column, or default to center
      const align = columnAlignments[i] || columnAlignments[columnAlignments.length - 1] || 'center'
      const ommlAlign = align === 'right' ? 'right' : align === 'left' ? 'left' : 'center'
      mcsChildren.push({
        name: 'm:mc',
        type: 'tag',
        attribs: {},
        children: [
          {
            name: 'm:mcPr',
            type: 'tag',
            attribs: {},
            children: [
              {
                name: 'm:count',
                type: 'tag',
                attribs: { 'm:val': '1' },
                children: []
              },
              {
                name: 'm:mcJc',
                type: 'tag',
                attribs: { 'm:val': ommlAlign },
                children: []
              }
            ]
          }
        ]
      })
    }
  } else {
    // Default: single m:mc for all columns with center alignment
    mcsChildren.push({
      name: 'm:mc',
      type: 'tag',
      attribs: {},
      children: [
        {
          name: 'm:mcPr',
          type: 'tag',
          attribs: {},
          children: [
            {
              name: 'm:count',
              type: 'tag',
              attribs: { 'm:val': cellsPerRowCount.toString() },
              children: []
            },
            {
              name: 'm:mcJc',
              type: 'tag',
              attribs: { 'm:val': 'center' },
              children: []
            }
          ]
        }
      ]
    })
  }

  const targetElement = {
    name: 'm:m',
    type: 'tag',
    attribs: {},
    children: [
      {
        name: 'm:mPr',
        type: 'tag',
        attribs: {},
        children: [
          {
            name: 'm:baseJc',
            type: 'tag',
            attribs: {
              'm:val': 'center'
            },
            children: []
          },
          {
            name: 'm:plcHide',
            type: 'tag',
            attribs: {
              'm:val': 'on'
            },
            children: []
          },
          {
            name: 'm:mcs',
            type: 'tag',
            attribs: {},
            children: mcsChildren
          }
        ]
      }
    ]
  }
  targetParent.children.push(targetElement)
  return targetElement
}

function mtd(element, targetParent, previousSibling, nextSibling, ancestors) {
  // table cell
  const targetElement = {
    name: 'm:e',
    type: 'tag',
    attribs: {},
    children: []
  }
  targetParent.children.push(targetElement)
  return targetElement
}

function mtr(element, targetParent, previousSibling, nextSibling, ancestors) {
  // table row
  const targetElement = {
    name: 'm:mr',
    type: 'tag',
    attribs: {},
    children: []
  }
  targetParent.children.push(targetElement)
  return targetElement
}

function munderover(element, targetParent, previousSibling, nextSibling, ancestors) {
  // Munderover
  if (element.children.length !== 3) {
    // treat as mrow
    return targetParent
  }

  ancestors = [...ancestors]
  ancestors.unshift(element)

  const base = element.children[0]
  const underscript = element.children[1]
  const overscript = element.children[2]

  //
  // m:nAry
  //
  // Conditions:
  // 1. base text must be nary operator
  // 2. no accents
  const naryChar = getNary(base)
  if (
    naryChar &&
    element.attributes?.accent?.toLowerCase() !== 'true' &&
    element.attributes?.accentunder?.toLowerCase() !== 'true'
  ) {
    const topTarget = getNaryTarget(naryChar, element, 'undOvr')
    element.isNary = true
    const subscriptTarget = {
      name: 'm:sub',
      type: 'tag',
      attribs: {},
      children: []
    }
    const superscriptTarget = {
      name: 'm:sup',
      type: 'tag',
      attribs: {},
      children: []
    }
    walker(underscript, subscriptTarget, false, false, ancestors)
    walker(overscript, superscriptTarget, false, false, ancestors)
    topTarget.children.push(subscriptTarget)
    topTarget.children.push(superscriptTarget)
    topTarget.children.push({ type: 'tag', name: 'm:e', attribs: {}, children: [] })
    targetParent.children.push(topTarget)
    return
  }

  // Fallback: m:limUpp()m:limlow

  const baseTarget = {
    name: 'm:e',
    type: 'tag',
    attribs: {},
    children: []
  }

  walker(base, baseTarget, false, false, ancestors)

  const underscriptTarget = {
    name: 'm:lim',
    type: 'tag',
    attribs: {},
    children: []
  }
  const overscriptTarget = {
    name: 'm:lim',
    type: 'tag',
    attribs: {},
    children: []
  }

  walker(underscript, underscriptTarget, false, false, ancestors)
  walker(overscript, overscriptTarget, false, false, ancestors)
  targetParent.children.push({
    type: 'tag',
    name: 'm:limUpp',
    attribs: {},
    children: [
      {
        type: 'tag',
        name: 'm:e',
        attribs: {},
        children: [
          {
            type: 'tag',
            name: 'm:limLow',
            attribs: {},
            children: [baseTarget, underscriptTarget]
          }
        ]
      },
      overscriptTarget
    ]
  })
  // Don't iterate over children in the usual way.
}

function getStyle(element, ancestors, previousStyle = {}) {
  const elAttributes = element.attribs || {}
  const color =
    elAttributes.mathcolor ||
    ancestors.find(
      (element) => element.name === 'mstyle' && element.attribs && element.attribs.color
    )?.attribs.color ||
    ''
  // const minsize = parseFloat(elAttributes.scriptminsize || ancestors.find(element => element.name === 'mstyle' && element.attribs && element.attribs.scriptminsize)?.attribs.scriptminsize || '8pt')
  // const sizemultiplier = parseFloat(elAttributes.scriptsizemultiplier || ancestors.find(element => element.name === 'mstyle' && element.attribs && element.attribs.scriptsizemultiplier)?.attribs.scriptsizemultiplier || '0.71')
  const size =
    elAttributes.mathsize ||
    ancestors.find(
      (element) => element.name === 'mstyle' && element.attribs && element.attribs.mathsize
    )?.attribs.mathsize ||
    ''
  const scriptlevel =
    elAttributes.scriptlevel ||
    ancestors.find(
      (element) => element.name === 'mstyle' && element.attribs && element.attribs.scriptlevel
    )?.attribs.scriptlevel ||
    ''
  const background =
    elAttributes.mathbackground ||
    ancestors.find(
      (element) => element.name === 'mstyle' && element.attribs && element.attribs.mathbackground
    )?.attribs.mathbackground ||
    ''
  let variant =
    elAttributes.mathvariant ||
    ancestors.find(
      (element) => element.name === 'mstyle' && element.attribs && element.attribs.mathvariant
    )?.attribs.mathvariant ||
    ''
  if (variant === 'b-i') {
    variant = 'bold-italic'
  }
  const fontweight =
    elAttributes.fontweight ||
    ancestors.find(
      (element) => element.name === 'mstyle' && element.attribs && element.attribs.fontweight
    )?.attribs.fontweight ||
    ''
  if (fontweight === 'bold' && !['bold', 'bold-italic'].includes(variant)) {
    if (variant.includes('italic')) {
      variant = 'bold-italic'
    } else {
      variant = 'bold'
    }
  } else if (fontweight === 'normal' && ['bold', 'bold-italic'].includes(variant)) {
    if (variant.includes('italic')) {
      variant = 'italic'
    } else {
      variant = ''
    }
  }
  const fontstyle =
    elAttributes.fontstyle ||
    ancestors.find(
      (element) => element.name === 'mstyle' && element.attribs && element.attribs.fontstyle
    )?.attribs.fontstyle ||
    ''
  if (fontstyle === 'italic' && !['italic', 'bold-italic'].includes(variant)) {
    if (variant.includes('bold')) {
      variant = 'bold-italic'
    } else {
      variant = 'italic'
    }
  } else if (fontstyle === 'normal' && ['italic', 'bold-italic'].includes(variant)) {
    if (variant.includes('bold')) {
      variant = 'bold'
    } else {
      variant = ''
    }
  }
  // Override variant for some types
  if (!elAttributes.mathvariant) {
    const textContent = getTextContent(element)
    if (
      previousStyle.variant === '' &&
      ((element.name === 'mi' && textContent.length > 1) ||
        (element.name === 'mn' && !/^\d+\.\d+$/.test(textContent)))
    ) {
      variant = ''
    } else if (
      ['mi', 'mn', 'mo'].includes(element.name) &&
      ['italic', 'bold-italic'].includes(previousStyle.variant)
    ) {
      if (fontweight === 'bold') {
        variant = 'bold-italic'
      } else {
        variant = 'italic'
      }
    }
  }

  return {
    color,
    variant,
    size,
    scriptlevel,
    background,
    fontstyle
  }
}

const STYLES = {
  bold: 'b',
  italic: 'i',
  'bold-italic': 'bi'
}

function textContainer(element, targetParent, previousSibling, nextSibling, ancestors, textType) {
  if (previousSibling.isNary) {
    const previousSiblingTarget = targetParent.children[targetParent.children.length - 1]
    targetParent = previousSiblingTarget.children[previousSiblingTarget.children.length - 1]
  }

  const hasMglyphChild = element.children?.find((element) => element.name === 'mglyph')
  const style = getStyle(element, ancestors, previousSibling?.style)
  element.style = style // Add it to element to make it comparable
  element.hasMglyphChild = hasMglyphChild
  const styleSame =
    Object.keys(style).every((key) => {
      const previousStyle = previousSibling?.style
      return previousStyle && style[key] === previousStyle[key]
    }) && previousSibling?.hasMglyphChild === hasMglyphChild
  const sameGroup = // Only group mtexts or mi, mn, mo with oneanother.
    textType === previousSibling?.name ||
    (['mi', 'mn', 'mo'].includes(textType) && ['mi', 'mn', 'mo'].includes(previousSibling?.name))
  let targetElement
  if (sameGroup && styleSame && !hasMglyphChild) {
    const rElement = targetParent.children[targetParent.children.length - 1]
    targetElement = rElement.children[rElement.children.length - 1]
  } else {
    const rElement = {
      name: 'm:r',
      type: 'tag',
      attribs: {},
      children: []
    }

    if (style.variant) {
      const wrPr = {
        name: 'w:rPr',
        type: 'tag',
        attribs: {},
        children: []
      }
      if (style.variant.includes('bold')) {
        wrPr.children.push({ name: 'w:b', type: 'tag', attribs: {}, children: [] })
      }
      if (style.variant.includes('italic')) {
        wrPr.children.push({ name: 'w:i', type: 'tag', attribs: {}, children: [] })
      }
      rElement.children.push(wrPr)
      const mrPr = {
        name: 'm:rPr',
        type: 'tag',
        attribs: {},
        children: [
          {
            name: 'm:nor',
            type: 'tag',
            attribs: {},
            children: []
          }
        ]
      }
      if (style.variant !== 'italic') {
        mrPr.children.push({
          name: 'm:sty',
          type: 'tag',
          attribs: {
            'm:val': STYLES[style.variant]
          },
          children: []
        })
      }
      rElement.children.push(mrPr)
    } else if (hasMglyphChild || textType === 'mtext') {
      rElement.children.push({
        name: 'm:rPr',
        type: 'tag',
        attribs: {},
        children: [
          {
            name: 'm:nor',
            type: 'tag',
            attribs: {},
            children: []
          }
        ]
      })
    } else if (style.fontstyle === 'normal' || (textType === 'ms' && style.fontstyle === '')) {
      rElement.children.push({
        name: 'm:rPr',
        type: 'tag',
        attribs: {},
        children: [
          {
            name: 'm:sty',
            type: 'tag',
            attribs: { 'm:val': 'p' },
            children: []
          }
        ]
      })
    }

    targetElement = {
      name: 'm:t',
      type: 'tag',
      attribs: {
        'xml:space': 'preserve'
      },
      children: []
    }
    rElement.children.push(targetElement)
    targetParent.children.push(rElement)
  }
  return targetElement
}

function mtext(element, targetParent, previousSibling, nextSibling, ancestors) {
  return textContainer(element, targetParent, previousSibling, nextSibling, ancestors, 'mtext')
}

function mi(element, targetParent, previousSibling, nextSibling, ancestors) {
  return textContainer(element, targetParent, previousSibling, nextSibling, ancestors, 'mi')
}

function mn(element, targetParent, previousSibling, nextSibling, ancestors) {
  return textContainer(element, targetParent, previousSibling, nextSibling, ancestors, 'mn')
}

function mo(element, targetParent, previousSibling, nextSibling, ancestors) {
  // Check for invisible operators that should be converted to thin space
  const textContent = decodeHtmlEntities(getTextContent(element))
  // U+2061 is "function application" - used after \log, \sin, \cos, etc.
  if (textContent === '\u2061') {
    targetParent.children.push({
      name: 'm:r',
      type: 'tag',
      attribs: {},
      children: [
        {
          name: 'm:t',
          type: 'tag',
          attribs: { 'xml:space': 'preserve' },
          children: [{ type: 'text', data: UNICODE_SPACES.THIN_SPACE }]
        }
      ]
    })
    return null
  }

  // Handle lspace attribute - add space before operator
  const lspace = element.attribs?.lspace
  if (lspace) {
    const spaceChar = spaceValueToUnicode(lspace)
    if (spaceChar) {
      targetParent.children.push({
        name: 'm:r',
        type: 'tag',
        attribs: {},
        children: [
          {
            name: 'm:t',
            type: 'tag',
            attribs: { 'xml:space': 'preserve' },
            children: [{ type: 'text', data: spaceChar }]
          }
        ]
      })
    }
  }

  // Process the operator itself
  const result = textContainer(element, targetParent, previousSibling, nextSibling, ancestors, 'mo')

  // Handle rspace attribute - add space after operator
  const rspace = element.attribs?.rspace
  if (rspace) {
    const spaceChar = spaceValueToUnicode(rspace)
    if (spaceChar) {
      targetParent.children.push({
        name: 'm:r',
        type: 'tag',
        attribs: {},
        children: [
          {
            name: 'm:t',
            type: 'tag',
            attribs: { 'xml:space': 'preserve' },
            children: [{ type: 'text', data: spaceChar }]
          }
        ]
      })
    }
  }

  // Handle movablelimits operators (sup, inf, max, min, lim, etc.)
  // These operators need a thin space after them when followed by mi
  if (element.attribs?.movablelimits === 'true' && nextSibling?.name === 'mi') {
    targetParent.children.push({
      name: 'm:r',
      type: 'tag',
      attribs: {},
      children: [
        {
          name: 'm:t',
          type: 'tag',
          attribs: { 'xml:space': 'preserve' },
          children: [{ type: 'text', data: UNICODE_SPACES.THIN_SPACE }]
        }
      ]
    })
  }

  return result
}

function ms(element, targetParent, previousSibling, nextSibling, ancestors) {
  return textContainer(element, targetParent, previousSibling, nextSibling, ancestors, 'ms')
}

const UPPER_COMBINATION = {
  '\u2190': '\u20D6', // arrow left
  '\u27F5': '\u20D6', // arrow left, long
  '\u2192': '\u20D7', // arrow right
  '\u27F6': '\u20D7', // arrow right, long
  '\u00B4': '\u0301', // accute
  '\u02DD': '\u030B', // accute, double
  '\u02D8': '\u0306', // breve
  ˇ: '\u030C', // caron
  '\u00B8': '\u0312', // cedilla
  '\u005E': '\u0302', // circumflex accent
  '\u00A8': '\u0308', // diaresis
  '\u02D9': '\u0307', // dot above
  '\u0060': '\u0300', // grave accent
  '\u002D': '\u0305', // hyphen -> overline
  '\u00AF': '\u0305', // macron
  '\u2212': '\u0305', // minus -> overline
  '\u002E': '\u0307', // period -> dot above
  '\u007E': '\u0303', // tilde
  '\u02DC': '\u0303', // small tilde
  '\u02DA': '\u030A', // ring above (mathring)
  '\u20DB': '\u20DB', // combining three dots above (dddot) - already combining
}

function underOrOver(element, targetParent, previousSibling, nextSibling, ancestors, direction) {
  // Munder/Mover

  if (element.children.length !== 2) {
    // treat as mrow
    return targetParent
  }

  ancestors = [...ancestors]
  ancestors.unshift(element)

  const base = element.children[0]
  const script = element.children[1]

  // Munder/Mover can be translated to ooml in different ways.

  // First we check for m:nAry.
  //
  // m:nAry
  //
  // Conditions:
  // 1. base text must be nary operator
  // 2. no accents
  const naryChar = getNary(base)

  if (
    naryChar &&
    element.attribs?.accent?.toLowerCase() !== 'true' &&
    element.attribs?.accentunder?.toLowerCase() !== 'true'
  ) {
    const topTarget = getNaryTarget(
      naryChar,
      element,
      'undOvr',
      direction === 'over',
      direction === 'under'
    )
    element.isNary = true

    const subscriptTarget = {
      name: 'm:sub',
      type: 'tag',
      attribs: {},
      children: []
    }
    const superscriptTarget = {
      name: 'm:sup',
      type: 'tag',
      attribs: {},
      children: []
    }
    walker(
      script,
      direction === 'under' ? subscriptTarget : superscriptTarget,
      false,
      false,
      ancestors
    )
    topTarget.children.push(subscriptTarget)
    topTarget.children.push(superscriptTarget)
    topTarget.children.push({ type: 'tag', name: 'm:e', attribs: {}, children: [] })
    targetParent.children.push(topTarget)
    return
  }

  const scriptText = decodeHtmlEntities(getTextContent(script))

  const baseTarget = {
    name: 'm:e',
    type: 'tag',
    attribs: {},
    children: []
  }
  walker(base, baseTarget, false, false, ancestors)

  //
  // m:bar
  //
  // Then we check whether it should be an m:bar.
  // This happens if:
  // 1. The script text is a single character that corresponds to
  //    underbar (\u0332, \u005F) or overbar (\u0305, \u00AF, \u2015, \u203E)
  // 2. The type of the script element is mo.
  const UNDERBAR_CHARS = ['\u0332', '\u005F', '\u2581', '\u23AF', '\u2015', '\u203E']
  const OVERBAR_CHARS = ['\u0305', '\u00AF', '\u2015', '\u203E', '\u2594', '\u23AF']
  if (
    (direction === 'under' && script.name === 'mo' && UNDERBAR_CHARS.includes(scriptText)) ||
    (direction === 'over' && script.name === 'mo' && OVERBAR_CHARS.includes(scriptText))
  ) {
    // m:bar - simple structure that stretches to content width
    targetParent.children.push({
      type: 'tag',
      name: 'm:bar',
      attribs: {},
      children: [
        {
          type: 'tag',
          name: 'm:barPr',
          attribs: {},
          children: [
            {
              type: 'tag',
              name: 'm:pos',
              attribs: {
                'm:val': direction === 'under' ? 'bot' : 'top'
              },
              children: []
            }
          ]
        },
        baseTarget
      ]
    })
    return
  }

  // m:acc
  //
  // Next we try to see if it is an m:acc. This is the case if:
  // 1. The scriptText is 0-1 characters long.
  // 2. The script is an mo-element
  // 3. The accent is set OR the character is in UPPER_COMBINATION (for widehat/widetilde)
  //
  // For \widehat and \widetilde, MathJax doesn't set accent="true" but uses ^ and ~.
  // Word's m:acc will automatically stretch the accent character to fit the base width.
  const isAccentChar = scriptText in UPPER_COMBINATION
  if (
    (direction === 'under' &&
      element.attribs?.accentunder?.toLowerCase() === 'true' &&
      script.name === 'mo' &&
      scriptText.length < 2) ||
    (direction === 'over' &&
      (element.attribs?.accent?.toLowerCase() === 'true' || isAccentChar) &&
      script.name === 'mo' &&
      scriptText.length < 2)
  ) {
    // m:acc
    targetParent.children.push({
      type: 'tag',
      name: 'm:acc',
      attribs: {},
      children: [
        {
          type: 'tag',
          name: 'm:accPr',
          attribs: {},
          children: [
            {
              type: 'tag',
              name: 'm:chr',
              attribs: {
                'm:val': UPPER_COMBINATION[scriptText] || scriptText
              },
              children: []
            }
          ]
        },
        baseTarget
      ]
    })
    return
  }
  // m:groupChr
  //
  // Now we try m:groupChr. Conditions are:
  // 1. Base is an 'mrow' and script is an 'mo'.
  // 2. Script length is 1.
  // 3. No accent
  // 4. Character must be stretchable (not ^ or ~ which should use m:acc)
  //
  // Characters that Word can stretch in groupChr:
  // - U+23DE ⏞ TOP CURLY BRACKET (overbrace)
  // - U+23DF ⏟ BOTTOM CURLY BRACKET (underbrace)
  // - U+2192 → RIGHTWARDS ARROW
  // - U+2190 ← LEFTWARDS ARROW
  // - U+2194 ↔ LEFT RIGHT ARROW
  // - Horizontal line characters (for overline/underline - but those use m:bar)
  const GROUPCHR_STRETCHABLE = new Set([
    '\u23DE', // ⏞ TOP CURLY BRACKET
    '\u23DF', // ⏟ BOTTOM CURLY BRACKET
    '\u2192', // → RIGHTWARDS ARROW
    '\u2190', // ← LEFTWARDS ARROW
    '\u2194', // ↔ LEFT RIGHT ARROW
    '\u21D2', // ⇒ RIGHTWARDS DOUBLE ARROW
    '\u21D0', // ⇐ LEFTWARDS DOUBLE ARROW
    '\u21D4', // ⇔ LEFT RIGHT DOUBLE ARROW
    '\u23DC', // ⏜ TOP PARENTHESIS
    '\u23DD', // ⏝ BOTTOM PARENTHESIS
  ])

  if (
    element.attribs?.accent?.toLowerCase() !== 'true' &&
    element.attribs?.accentunder?.toLowerCase() !== 'true' &&
    script.name === 'mo' &&
    base.name === 'mrow' &&
    scriptText.length === 1 &&
    GROUPCHR_STRETCHABLE.has(scriptText)
  ) {
    targetParent.children.push({
      type: 'tag',
      name: 'm:groupChr',
      attribs: {},
      children: [
        {
          type: 'tag',
          name: 'm:groupChrPr',
          attribs: {},
          children: [
            {
              type: 'tag',
              name: 'm:chr',
              attribs: { 'm:val': scriptText },
              children: []
            },
            {
              type: 'tag',
              name: 'm:pos',
              attribs: { 'm:val': direction === 'under' ? 'bot' : 'top' },
              children: []
            },
            {
              type: 'tag',
              name: 'm:vertJc',
              attribs: { 'm:val': direction === 'under' ? 'top' : 'bot' },
              children: []
            }
          ]
        },
        baseTarget
      ]
    })
    return
  }
  // Fallback: m:lim

  const scriptTarget = {
    name: 'm:lim',
    type: 'tag',
    attribs: {},
    children: []
  }

  walker(script, scriptTarget, false, false, ancestors)
  targetParent.children.push({
    type: 'tag',
    name: direction === 'under' ? 'm:limLow' : 'm:limUpp',
    attribs: {},
    children: [baseTarget, scriptTarget]
  })
  // Don't iterate over children in the usual way.
}

function munder(element, targetParent, previousSibling, nextSibling, ancestors) {
  return underOrOver(element, targetParent, previousSibling, nextSibling, ancestors, 'under')
}

function mover(element, targetParent, previousSibling, nextSibling, ancestors) {
  return underOrOver(element, targetParent, previousSibling, nextSibling, ancestors, 'over')
}

function mroot(element, targetParent, previousSibling, nextSibling, ancestors) {
  // Root
  if (element.children.length !== 2) {
    // treat as mrow
    return targetParent
  }
  ancestors = [...ancestors]
  ancestors.unshift(element)
  const base = element.children[0]
  const root = element.children[1]

  const baseTarget = {
    type: 'tag',
    name: 'm:e',
    attribs: {},
    children: []
  }
  walker(base, baseTarget, false, false, ancestors)

  const rootTarget = {
    type: 'tag',
    name: 'm:deg',
    attribs: {},
    children: []
  }
  walker(root, rootTarget, false, false, ancestors)

  const rootText = getTextContent(root)

  targetParent.children.push({
    type: 'tag',
    name: 'm:rad',
    attribs: {},
    children: [
      {
        type: 'tag',
        name: 'm:radPr',
        attribs: {},
        children: [
          {
            type: 'tag',
            name: 'm:degHide',
            attribs: { 'm:val': rootText.length ? 'off' : 'on' },
            children: []
          }
        ]
      },
      rootTarget,
      baseTarget
    ]
  })
}

function text(element, targetParent, previousSibling, nextSibling, ancestors) {
  let text = element.data.replace(/[\u2062]|[\u200B]/g, '')
  if (ancestors.find((element) => ['mi', 'mn', 'mo'].includes(element.name))) {
    text = text.replace(/\s/g, '')
  } else {
    const ms = ancestors.find((element) => element.name === 'ms')
    if (ms) {
      text = (ms.attribs?.lquote || '"') + text + (ms.attribs?.rquote || '"')
    }
  }
  if (text.length) {
    if (
      targetParent.children.length &&
      targetParent.children[targetParent.children.length - 1].type === 'text'
    ) {
      targetParent.children[targetParent.children.length - 1].data += text
    } else {
      targetParent.children.push({
        type: 'text',
        data: text
      })
    }
  }
  return targetParent
}

const mathmlHandlers = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  math: math,
  menclose: menclose,
  mfrac: mfrac,
  mglyph: mglyph,
  mi: mi,
  mmultiscripts: mmultiscripts,
  mn: mn,
  mo: mo,
  mover: mover,
  mroot: mroot,
  mrow: mrow,
  ms: ms,
  mspace: mspace,
  msqrt: msqrt,
  mstyle: mstyle,
  msub: msub,
  msubsup: msubsup,
  msup: msup,
  mtable: mtable,
  mtd: mtd,
  mtext: mtext,
  mtr: mtr,
  munder: munder,
  munderover: munderover,
  semantics: semantics,
  text: text
})

function walker(
  element,
  targetParent,
  previousSibling = false,
  nextSibling = false,
  ancestors = []
) {
  if (
    !previousSibling &&
    ['m:deg', 'm:den', 'm:e', 'm:fName', 'm:lim', 'm:num', 'm:sub', 'm:sup'].includes(
      targetParent.name
    )
  ) {
    // We are walking through the first element within one of the
    // elements where an <m:argPr> might occur. The <m:argPr> can specify
    // the scriptlevel, but it only makes sense if there is some content.
    // The fact that we are here means that there is at least one content item.
    // So we will check whether to add the m:rPr.
    // For possible parent types, see
    // https://docs.microsoft.com/en-us/dotnet/api/documentformat.openxml.math.argumentproperties?view=openxml-2.8.1#remarks
    addScriptlevel(targetParent, ancestors)
  }
  let targetElement
  const nameOrType = element.name || element.type
  if (mathmlHandlers[nameOrType]) {
    targetElement = mathmlHandlers[nameOrType](
      element,
      targetParent,
      previousSibling,
      nextSibling,
      ancestors
    )
  } else {
    if (nameOrType && nameOrType !== 'root') {
      console.warn(`Type not supported: ${nameOrType}`)
    }

    targetElement = targetParent
  }

  if (!targetElement) {
    // Target element hasn't been assigned, so don't handle children.
    return
  }
  if (element.children?.length) {
    ancestors = [...ancestors]
    ancestors.unshift(element)
    for (let i = 0; i < element.children.length; i++) {
      walker(
        element.children[i],
        targetElement,
        element.children[i - 1],
        element.children[i + 1],
        ancestors
      )
    }
  }
}

class MML2OMML {
  constructor(mmlString, options) {
    this.inString = mmlString
    this.inXML = parse(mmlString, options)
    this.outXML = false
    this.outString = false
  }

  run() {
    const outXML = {}
    walker({ children: this.inXML, type: 'root' }, outXML)
    this.outXML = outXML
  }

  getResult() {
    this.outString = stringifyDoc([this.outXML])
    return this.outString
  }
}

const mml2omml = (mmlString, options) => {
  const converter = new MML2OMML(mmlString, options)
  converter.run()
  return converter.getResult()
}

export { mml2omml }
//# sourceMappingURL=index.esm.js.map
