import { Logging } from "@google-cloud/logging";

/**
 * Writes an error log entry to Google Cloud Logging.
 *
 * @param {string} [projectId='bg-tracking-staging'] - Your Google Cloud Platform project ID.
 * @param {string} [logName='my-log'] - The name of the log to write to.
 * @param {Error} [error=new Error('No error message provided')] - The error object to log.
 */
export async function logErrorToGCP(
  projectId = "bg-tracking-staging",
  logName = "my-log",
  error = new Error("No error message provided")
) {
  // Creates a client
  const logging = new Logging({ projectId });

  // Selects the log to write to
  const log = logging.log(logName);

  // Uses the message from the error, if available
  const text =
    error && error.message ? error.message : "No error message provided";

  // Prepares the metadata associated with the entry
  const metadata = {
    resource: {
      type: "cloud_function",
      labels: { function_name: process.env.GCP_FUNCTION_NAME },
    },
    // See: https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#logseverity
    severity: "ERROR",
    labels: {
      ...error.response,
    },
  };

  // Prepares a log entry with the provided metadata and text from the error message
  const entry = log.entry(metadata, text);

  // Writes the log entry
  try {
    await log.write(entry);
    console.log(`Logged: ${text}`);
  } catch (error) {
    console.error("Failed to log to GCP:", error);
  }
}
