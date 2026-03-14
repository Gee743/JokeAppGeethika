CREATE DATABASE IF NOT EXISTS jokesdb;
USE jokesdb;

CREATE TABLE IF NOT EXISTS types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS jokes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setup TEXT NOT NULL,
  punchline TEXT NOT NULL,
  type_id INT NOT NULL,
  CONSTRAINT fk_jokes_type FOREIGN KEY (type_id) REFERENCES types(id)
);

INSERT IGNORE INTO types (name) VALUES ('programming'), ('dad'), ('general');

INSERT INTO jokes (setup, punchline, type_id)
SELECT 'Why do programmers hate nature?', 'Too many bugs.', t.id FROM types t WHERE t.name='programming'
UNION ALL
SELECT 'Why did the computer get cold?', 'It forgot to close Windows.', t.id FROM types t WHERE t.name='programming'
UNION ALL
SELECT 'I only know 25 letters of the alphabet.', 'I don’t know y.', t.id FROM types t WHERE t.name='dad'
UNION ALL
SELECT 'Why don’t skeletons fight each other?', 'They don’t have the guts.', t.id FROM types t WHERE t.name='general';