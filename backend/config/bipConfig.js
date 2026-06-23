/**
 * BI Publisher Configuration
 * * Note: Oracle is deprecating Basic Auth for BIP in some versions in favor of OAuth.
 * If your environment requires OAuth, you would replace the username/password 
 * logic here with a token-fetching function.
 */

require('dotenv').config();

const bipConfig = {
  // Use environment variables for security
  username: process.env.BIP_USERNAME,
  password: process.env.BIP_PASSWORD,
  
  // WSDL Endpoints
  // Ensure these match your BIP server URL (usually port 9704)
  endpoints: {
    reportService: `${process.env.BIP_BASE_URL}/services/v2/ReportService?WSDL`,
    catalogService: `${process.env.BIP_BASE_URL}/services/v2/CatalogService?WSDL`
  },
  
  // SOAP Request Options
  options: {
    timeout: 30000, // 30 seconds
    // Force strict SSL if needed, otherwise set to false for dev/internal networks
    rejectUnauthorized: process.env.NODE_ENV === 'production' 
  }
};

module.exports = bipConfig;