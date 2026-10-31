/**
 * FastPDFx — PDF Page Range Parser & Validator
 * Handles parsing, validation, and deduplication of page range syntax.
 *
 * Supported formats:
 * - Single pages: "1", "3", "5"
 * - Contiguous ranges: "1-3", "4-6"
 * - Mixed lists: "1-3, 5, 7-9"
 * - Arbitrary spacing: "1 - 3 , 5 ,  8 - 10"
 */

export interface ParsedRangeChunk {
  raw: string;
  start: number;
  end: number;
  pages: number[]; // Unique 1-based page numbers in this chunk
}

export interface ParseRangeResult {
  isValid: boolean;
  error: string | null;
  chunks: ParsedRangeChunk[];
  allUniquePages: number[]; // Deduplicated across all chunks, preserving order
  totalPagesCount: number;
}

/**
 * Validates and parses a user-entered page range string against a document page count.
 *
 * @param input Raw string entered by the user (e.g. "1-3, 5, 7-9")
 * @param maxPages Total number of pages in the source PDF
 */
export function parseCustomPageRanges(input: string, maxPages: number): ParseRangeResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      isValid: false,
      error: 'Please enter at least one page number or range (e.g. 1-3, 5).',
      chunks: [],
      allUniquePages: [],
      totalPagesCount: 0
    };
  }

  if (maxPages < 1) {
    return {
      isValid: false,
      error: 'Document contains no valid pages to split.',
      chunks: [],
      allUniquePages: [],
      totalPagesCount: 0
    };
  }

  // Check for trailing or leading commas or empty sections like "1,,3"
  const rawParts = trimmed.split(',');
  const chunks: ParsedRangeChunk[] = [];
  const seenPagesGlobal = new Set<number>();
  const allUniquePages: number[] = [];

  for (let i = 0; i < rawParts.length; i++) {
    const token = rawParts[i].trim();

    if (!token) {
      return {
        isValid: false,
        error: `Empty page token found at position ${i + 1}. Please remove duplicate or trailing commas.`,
        chunks: [],
        allUniquePages: [],
        totalPagesCount: 0
      };
    }

    if (token.includes('-')) {
      // Range token e.g. "1-3" or "1 - 3"
      const dashParts = token.split('-').map(p => p.trim());

      if (dashParts.length !== 2 || dashParts[0] === '' || dashParts[1] === '') {
        return {
          isValid: false,
          error: `Invalid range format: "${token}". Use standard format like "1-3".`,
          chunks: [],
          allUniquePages: [],
          totalPagesCount: 0
        };
      }

      // Validate integers only
      if (!/^\d+$/.test(dashParts[0]) || !/^\d+$/.test(dashParts[1])) {
        return {
          isValid: false,
          error: `Invalid characters in "${token}". Page numbers must be whole positive integers.`,
          chunks: [],
          allUniquePages: [],
          totalPagesCount: 0
        };
      }

      const start = Number(dashParts[0]);
      const end = Number(dashParts[1]);

      if (start < 1) {
        return {
          isValid: false,
          error: `Range start cannot be less than 1 (found ${start} in "${token}").`,
          chunks: [],
          allUniquePages: [],
          totalPagesCount: 0
        };
      }

      if (end < 1) {
        return {
          isValid: false,
          error: `Range end cannot be less than 1 (found ${end} in "${token}").`,
          chunks: [],
          allUniquePages: [],
          totalPagesCount: 0
        };
      }

      if (start > maxPages) {
        return {
          isValid: false,
          error: `Start page ${start} exceeds total document pages (${maxPages}).`,
          chunks: [],
          allUniquePages: [],
          totalPagesCount: 0
        };
      }

      if (end > maxPages) {
        return {
          isValid: false,
          error: `End page ${end} exceeds total document pages (${maxPages}).`,
          chunks: [],
          allUniquePages: [],
          totalPagesCount: 0
        };
      }

      if (start > end) {
        return {
          isValid: false,
          error: `Invalid range "${token}": start page (${start}) is greater than end page (${end}).`,
          chunks: [],
          allUniquePages: [],
          totalPagesCount: 0
        };
      }

      const chunkPages: number[] = [];
      for (let p = start; p <= end; p++) {
        chunkPages.push(p);
        if (!seenPagesGlobal.has(p)) {
          seenPagesGlobal.add(p);
          allUniquePages.push(p);
        }
      }

      chunks.push({
        raw: `${start}–${end}`,
        start,
        end,
        pages: chunkPages
      });
    } else {
      // Single page token e.g. "5"
      if (!/^\d+$/.test(token)) {
        return {
          isValid: false,
          error: `"${token}" is not a valid page number. Please use whole positive integers.`,
          chunks: [],
          allUniquePages: [],
          totalPagesCount: 0
        };
      }

      const page = Number(token);

      if (page < 1) {
        return {
          isValid: false,
          error: `Page numbers must be 1 or greater (found ${page}).`,
          chunks: [],
          allUniquePages: [],
          totalPagesCount: 0
        };
      }

      if (page > maxPages) {
        return {
          isValid: false,
          error: `Page ${page} exceeds total document pages (${maxPages}).`,
          chunks: [],
          allUniquePages: [],
          totalPagesCount: 0
        };
      }

      if (!seenPagesGlobal.has(page)) {
        seenPagesGlobal.add(page);
        allUniquePages.push(page);
      }

      chunks.push({
        raw: `${page}`,
        start: page,
        end: page,
        pages: [page]
      });
    }
  }

  if (chunks.length === 0) {
    return {
      isValid: false,
      error: 'No valid page numbers found.',
      chunks: [],
      allUniquePages: [],
      totalPagesCount: 0
    };
  }

  return {
    isValid: true,
    error: null,
    chunks,
    allUniquePages,
    totalPagesCount: allUniquePages.length
  };
}
