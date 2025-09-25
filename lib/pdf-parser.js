// Use CommonJS to avoid module issues
const pdf = require('pdf-parse/lib/pdf-parse');

async function parsePDF(dataBuffer) {
  try {
    const data = await pdf(dataBuffer, {
      // No test file needed
      pagerender: null,
      max: 0, // Parse all pages
    });
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw error;
  }
}

module.exports = { parsePDF };