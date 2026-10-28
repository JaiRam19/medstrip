ADR-1: Cabinet storage. The cabinet is stored as one Redis hash per user, 
cabinet:{userId}, with the medicine id as the field and the medicine as 
JSON in the value. No expiry. Chosen because every operation (list, add, delete) 
is one command, and writing the same id twice does not create a duplicate. 
Trade-off: a very large cabinet is held under one key, which is fine for 
a few thousand items per user. Where it lives: Redis only for now, 
with appendonly yes and a volume, as that means one server to run and gives me 
hands-on Redis practice. Risk: if the disk or machine is lost, the cabinet is lost. 
We will revisit a database (such as DynamoDB) for the cabinet after the main features work.
