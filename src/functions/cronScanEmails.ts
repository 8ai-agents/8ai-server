import { app, InvocationContext, Timer } from "@azure/functions";
import { ImapFlow } from "imapflow";
import { db } from "../DatabaseController";

export async function cronScanEmails(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("Scanning emails.");

  const organisationEmails = await db
    .selectFrom("organisation_emails")
    .selectAll()
    .execute();

  for (const organisationEmail of organisationEmails) {
    try {
      const emailsToProcess: {
        internalDate: Date;
        uid: number;
        threadId: number;
        sender: string;
        subject: string;
        isFromInternal: boolean;
        text: string;
      }[] = [];
      const client = new ImapFlow({
        host: organisationEmail.host,
        port: organisationEmail.port,
        secure: true,
        auth: {
          user: organisationEmail.username,
          pass: organisationEmail.password,
        },
      });
      await client.connect();
      // Select and lock a mailbox. Throws if mailbox does not exist
      const lock = await client.getMailboxLock("INBOX");
      try {
        // list subjects for all messages
        // uid value is always included in FETCH response, envelope strings are in unicode.
        for await (const {
          uid,
          threadId,
          internalDate,
          headers,
        } of client.fetch(
          { since: new Date(organisationEmail.last_updated) },
          {
            uid: true,
            threadId: true,
            internalDate: true,
            headers: ["From", "Subject"],
          }
        )) {
          const headerString = headers.toString();
          const headerItems: string[] = headerString.split("\r\n");
          const senderHeader = headerItems
            .find((item) => item.startsWith("From: "))
            .replace("From: ", "");
          const emailData = {
            internalDate,
            uid,
            threadId,
            sender: senderHeader.substring(
              senderHeader.indexOf("<") + 1,
              senderHeader.lastIndexOf(">")
            ),
            subject: headerItems
              .find((item) => item.startsWith("Subject: "))
              .replace("Subject: ", ""),
            isFromInternal: false,
            text: "",
          };
          if (
            emailData.sender.split("@")[1] ===
            organisationEmail.username.split("@")[1]
          ) {
            emailData.isFromInternal = true;
          }
          emailsToProcess.push(emailData);
        }

        for (const currentEmail of emailsToProcess) {
          const allEmailsInThread = emailsToProcess.filter(
            (e) => e.threadId === currentEmail.threadId
          );
          if (allEmailsInThread.length > 1) {
            // We only want to process the most recent one
            if (
              Math.max(
                ...allEmailsInThread.map((e) => e.internalDate.getTime())
              ) != currentEmail.internalDate.getTime()
            ) {
              // The current is not the latest, skip
            } else {
              // The current is the latest, process
              // Fetch the email
              const email = await client.fetchOne(currentEmail.uid, {
                source: true,
                bodyParts: ["TEXT"],
              });
              currentEmail.text = email.bodyParts[0].body;
              context.log(currentEmail.text);
            }
          }
        }
      } finally {
        // Make sure lock is released, otherwise next `getMailboxLock()` never returns
        lock.release();
      }

      // Sort emails
      emailsToProcess.sort((a, b) => {
        if (a.threadId !== b.threadId) {
          return a.threadId - b.threadId;
        } else {
          return a.internalDate.getTime() - b.internalDate.getTime();
        }
      });

      // log out and close connection
      await client.logout();
    } catch (error) {
      context.error(`Error scanning emails for ${organisationEmail.id}`);
      context.error(error);
    }
  }
}

app.timer("cronScanEmails", {
  schedule: "0 */5 * * * *",
  runOnStartup: true,
  handler: cronScanEmails,
});
