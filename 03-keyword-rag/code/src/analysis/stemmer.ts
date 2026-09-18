/**
 * Martin Porter's Stemming Algorithm for English (1980)
 * Pure TypeScript implementation without external dependencies.
 */

export class PorterStemmer {
  private static step1aRules: Array<[RegExp, string]> = [
    [/sses$/, 'ss'],
    [/ies$/, 'i'],
    [/ss$/, 'ss'],
    [/s$/, ''],
  ];

  private static doubleConsonants = /([^aeiouy])\1$/;

  private static isConsonant(word: string, i: number): boolean {
    const char = word[i];
    if ('aeiou'.includes(char)) return false;
    if (char === 'y') return i === 0 ? true : !PorterStemmer.isConsonant(word, i - 1);
    return true;
  }

  private static getMeasure(word: string): number {
    let m = 0;
    let i = 0;
    const len = word.length;

    while (i < len && PorterStemmer.isConsonant(word, i)) i++;
    if (i >= len) return 0;

    while (i < len) {
      while (i < len && !PorterStemmer.isConsonant(word, i)) i++;
      if (i >= len) break;
      m++;
      while (i < len && PorterStemmer.isConsonant(word, i)) i++;
    }

    return m;
  }

  private static containsVowel(word: string): boolean {
    for (let i = 0; i < word.length; i++) {
      if (!PorterStemmer.isConsonant(word, i)) return true;
    }
    return false;
  }

  private static endsCVC(word: string): boolean {
    const len = word.length;
    if (len < 3) return false;
    const c3 = word[len - 1];
    const c2 = word[len - 2];
    const c1 = word[len - 3];
    if (PorterStemmer.isConsonant(word, len - 1) &&
        !PorterStemmer.isConsonant(word, len - 2) &&
        PorterStemmer.isConsonant(word, len - 3)) {
      if (!'wxy'.includes(c3)) return true;
    }
    return false;
  }

  public static stem(word: string): string {
    if (word.length <= 2) return word;
    let w = word.toLowerCase();

    // Step 1a
    if (w.endsWith('sses')) w = w.slice(0, -2);
    else if (w.endsWith('ies')) w = w.slice(0, -2);
    else if (!w.endsWith('ss') && w.endsWith('s')) w = w.slice(0, -1);

    // Step 1b
    let step1bExtra = false;
    if (w.endsWith('eed')) {
      const stem = w.slice(0, -3);
      if (PorterStemmer.getMeasure(stem) > 0) w = stem + 'ee';
    } else if (w.endsWith('ed')) {
      const stem = w.slice(0, -2);
      if (PorterStemmer.containsVowel(stem)) {
        w = stem;
        step1bExtra = true;
      }
    } else if (w.endsWith('ing')) {
      const stem = w.slice(0, -3);
      if (PorterStemmer.containsVowel(stem)) {
        w = stem;
        step1bExtra = true;
      }
    }

    if (step1bExtra) {
      if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) {
        w += 'e';
      } else if (PorterStemmer.doubleConsonants.test(w) && !/[lsz]$/.test(w)) {
        w = w.slice(0, -1);
      } else if (PorterStemmer.getMeasure(w) === 1 && PorterStemmer.endsCVC(w)) {
        w += 'e';
      }
    }

    // Step 1c
    if (w.endsWith('y')) {
      const stem = w.slice(0, -1);
      if (PorterStemmer.containsVowel(stem)) {
        w = stem + 'i';
      }
    }

    // Step 2
    const step2Suffixes: Array<[string, string]> = [
      ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
      ['izer', 'ize'], ['abli', 'able'], ['alli', 'al'], ['entli', 'ent'],
      ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
      ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
      ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble']
    ];

    for (const [suffix, replacement] of step2Suffixes) {
      if (w.endsWith(suffix)) {
        const stem = w.slice(0, -suffix.length);
        if (PorterStemmer.getMeasure(stem) > 0) {
          w = stem + replacement;
        }
        break;
      }
    }

    // Step 3
    const step3Suffixes: Array<[string, string]> = [
      ['icate', 'ic'], ['ative', ''], ['alize', 'al'],
      ['iciti', 'ic'], ['ical', 'ic'], ['ful', ''], ['ness', '']
    ];

    for (const [suffix, replacement] of step3Suffixes) {
      if (w.endsWith(suffix)) {
        const stem = w.slice(0, -suffix.length);
        if (PorterStemmer.getMeasure(stem) > 0) {
          w = stem + replacement;
        }
        break;
      }
    }

    // Step 4
    const step4Suffixes = [
      'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement',
      'ment', 'ent', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize'
    ];

    for (const suffix of step4Suffixes) {
      if (w.endsWith(suffix)) {
        const stem = w.slice(0, -suffix.length);
        if (PorterStemmer.getMeasure(stem) > 1) {
          w = stem;
        }
        break;
      }
    }
    if (w.endsWith('ion')) {
      const stem = w.slice(0, -3);
      if (PorterStemmer.getMeasure(stem) > 1 && /[st]$/.test(stem)) {
        w = stem;
      }
    }

    // Step 5a
    if (w.endsWith('e')) {
      const stem = w.slice(0, -1);
      const m = PorterStemmer.getMeasure(stem);
      if (m > 1 || (m === 1 && !PorterStemmer.endsCVC(stem))) {
        w = stem;
      }
    }

    // Step 5b
    if (PorterStemmer.getMeasure(w) > 1 && w.endsWith('l') && PorterStemmer.doubleConsonants.test(w)) {
      w = w.slice(0, -1);
    }

    return w;
  }
}
