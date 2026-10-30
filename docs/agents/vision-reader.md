# Vision Reader: contract (schemaVersion 1)

## Purpose
Reads one medicine strip photo and returns the medicine name, strength and expiry date.

## Input
Kafka topic `medicine-photo-uploaded`, key = userId

{ "jobId": "...", "userId": "...", "s3Key": "...", "schemaVersion": 1 }

## Output (when the reading is good enough)
Kafka topic `medicine-extracted`, key = userId

{ "jobId": "...", "userId": "...", "name": "...", "strength": "...",
  "expiry": "YYYY-MM", "confidence": 0.0-1.0, "schemaVersion": 1 }

## What confidence means
The model's own estimate of how sure it is about the whole reading, from 0 to 1.
It is a guess, not a measurement, and a model can be confidently wrong.
So our code has the final say: a field that fails validation (for example an expiry that is
not YYYY-MM, or a date far in the past) is treated as missing, whatever the model says.
The thresholds below live in config, not in the prompt, so we can tune them from real results.

## Outcomes that are NOT errors
| Outcome | When | Job status | What the user sees |
|---|---|---|---|
| OK | confidence >= 0.7 and name, strength and expiry are all present and valid | LOOKING_UP | The reading is shown and processing continues |
| NEEDS_CONFIRMATION | confidence 0.5 to under 0.7, or one required field is missing or invalid | AWAITING_CONFIRMATION | "Is this right?" with the reading, where the user can correct a field |
| NEEDS_RETAKE | confidence under 0.5, or nothing readable (blurry, no medicine in the photo) | NEEDS_RETAKE | "We couldn't read this. Retake the photo in better light, with the strip flat." |

NEEDS_CONFIRMATION and NEEDS_RETAKE are normal results. Nothing is retried and
nothing goes to the dead letter topic.

## Real errors (retry, then dead letter)
- The model call times out, returns a 5xx, or is rate limited (retry with backoff).
- The photo is missing from S3 (retry briefly, then dead letter).
- The model returns output that cannot be parsed after the retries (dead letter).
- The event itself is invalid, for example not JSON or missing jobId (dead letter at once, no retry).
- Redis is unreachable when updating the job (retry with backoff).

## Rules
- Missing fields are `null`, never guessed.
- Expiry is always YYYY-MM.
- The agent never decides anything about safety. It only reads. Warnings come from later steps.
- A consumer that receives a `schemaVersion` it does not understand must not guess: it sends
  the message to the dead letter topic and logs it. Producers may add new optional fields
  within a version, but any change that breaks existing readers bumps the version.