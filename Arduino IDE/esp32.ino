#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <HTTPClient.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// -------------------------------------------------------------
// 1. Wi-Fi & Firebase Credentials
// -------------------------------------------------------------
const char* WIFI_SSID = "Nimess";        
const char* WIFI_PASSWORD = "11111111"; 

const char* FIREBASE_HOST = "https://smart-bin-e2a4e-default-rtdb.firebaseio.com";
const char* FIREBASE_AUTH = ""; 

// -------------------------------------------------------------
// 2. Hardware Pins Configuration
// -------------------------------------------------------------
Adafruit_SH1106G display = Adafruit_SH1106G(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

#define IR_1 4
#define TRIG_1 19
#define ECHO_1 20
#define SERVO_1_PIN 3

#define IR_2 21
#define TRIG_2 5    
#define ECHO_2 10    
#define SERVO_2_PIN 22

#define IR_3 0
#define TRIG_3 8
#define ECHO_3 9
#define SERVO_3_PIN 15

#define BUZZER_PIN 18

Servo servo1, servo2, servo3;

// --- Calibration Values ---
const int BIN_DEPTH = 14;  //  14cm (14cm = 0%)
const int MIN_DIST  = 2;   // 2cm = 100%

// Last valid distance storage 
long lastDist2 = BIN_DEPTH;
long lastDist3 = BIN_DEPTH;

unsigned long lastFirebaseUpdate = 0;
const long firebaseInterval = 2000; 

// --- Buzzer Timing Variables ---
unsigned long lastBuzzerTriggerTime = 0;
bool wasBinFull = false;
const unsigned long BUZZER_ON_TIME = 3000;      // 3sec (3000 ms)
const unsigned long BUZZER_INTERVAL = 60000;     // 1minit (60,000 ms)

// -------------------------------------------------------------
// 3. Helper Functions (With Noise Filtering)
// -------------------------------------------------------------
long getDistance(int trigPin, int echoPin, long prevDistance) {
  long totalDist = 0;
  int validReadings = 0;

  // min dist
  for (int i = 0; i < 3; i++) {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    long duration = pulseIn(echoPin, HIGH, 25000); // 25ms timeout
    if (duration > 0) {
      long dist = duration * 0.034 / 2;
      if (dist >= MIN_DIST && dist <= BIN_DEPTH + 5) {
        totalDist += dist;
        validReadings++;
      }
    }
    delay(5);
  }

  // correct sensor signal or not
  if (validReadings > 0) {
    return totalDist / validReadings;
  }
  return prevDistance; 
}

int calculatePercentage(long distance) {
  int pct = map(distance, BIN_DEPTH, MIN_DIST, 0, 100);
  return constrain(pct, 0, 100);
}

// Send Data to Firebase Realtime Database via REST API
void updateFirebase(int bin1, int bin2, int bin3) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    String url = String(FIREBASE_HOST) + "/bins.json";
    if (String(FIREBASE_AUTH) != "") {
      url += "?auth=" + String(FIREBASE_AUTH);
    }

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\"bin1\":" + String(bin1) +
                         ",\"bin2\":" + String(bin2) +
                         ",\"bin3\":" + String(bin3) + "}";

    int httpResponseCode = http.PATCH(jsonPayload);

    if (httpResponseCode > 0) {
      Serial.print("Firebase Update Success, Code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("Firebase Error: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }
}

// -------------------------------------------------------------
// 4. Setup
// -------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Wire.begin(6, 7);
  delay(250);

  pinMode(IR_1, INPUT); pinMode(IR_2, INPUT); pinMode(IR_3, INPUT);
  pinMode(TRIG_1, OUTPUT); pinMode(ECHO_1, INPUT);
  pinMode(TRIG_2, OUTPUT); pinMode(ECHO_2, INPUT);
  pinMode(TRIG_3, OUTPUT); pinMode(ECHO_3, INPUT);

  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);

  servo1.attach(SERVO_1_PIN);
  servo2.attach(SERVO_2_PIN);
  servo3.attach(SERVO_3_PIN);
  servo1.write(0); servo2.write(0); servo3.write(0);

  if (!display.begin(0x3C, true)) {
    for (;;);
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(10, 20);
  display.println("Connecting WiFi...");
  display.display();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int counter = 0;
  while (WiFi.status() != WL_CONNECTED && counter < 20) {
    delay(500);
    Serial.print(".");
    counter++;
  }

  display.clearDisplay();
  display.setCursor(10, 25);
  if (WiFi.status() == WL_CONNECTED) {
    display.println("WiFi Connected!");
  } else {
    display.println("WiFi Failed!");
  }
  display.display();
  delay(1500);
}

// -------------------------------------------------------------
// 5. Main Loop
// -------------------------------------------------------------
void loop() {
  // Auto Lid Open/Close
  if (digitalRead(IR_1) == LOW) servo1.write(90); else servo1.write(0);
  if (digitalRead(IR_2) == LOW) servo2.write(90); else servo2.write(0);
  if (digitalRead(IR_3) == LOW) servo3.write(90); else servo3.write(0);

  // Ultrasonic Readings (Noise-Filtered)
  lastDist1 = getDistance(TRIG_1, ECHO_1, lastDist1);
  lastDist2 = getDistance(TRIG_2, ECHO_2, lastDist2);
  lastDist3 = getDistance(TRIG_3, ECHO_3, lastDist3);

  int pct1 = calculatePercentage(lastDist1);
  int pct2 = calculatePercentage(lastDist2);
  int pct3 = calculatePercentage(lastDist3);

  // --- Non-blocking Buzzer Alert (3s ON, repeats every 1 minute if >= 80%) ---
  bool isAnyBinFull = (pct1 >= 80 || pct2 >= 80 || pct3 >= 80);
  unsigned long currentMillis = millis();

  if (isAnyBinFull) {
    if (!wasBinFull) {
      wasBinFull = true;
      lastBuzzerTriggerTime = currentMillis;
      tone(BUZZER_PIN, 2000);
    } 
    else if (currentMillis - lastBuzzerTriggerTime >= BUZZER_INTERVAL) {
      lastBuzzerTriggerTime = currentMillis;
      tone(BUZZER_PIN, 2000);
    }

    if (currentMillis - lastBuzzerTriggerTime >= BUZZER_ON_TIME) {
      noTone(BUZZER_PIN);
    }
  } else {
    noTone(BUZZER_PIN);
    wasBinFull = false;
  }

  // Send Data to Firebase every 2 seconds
  if (currentMillis - lastFirebaseUpdate >= firebaseInterval) {
    lastFirebaseUpdate = currentMillis;
    updateFirebase(pct1, pct2, pct3);
  }

  // Update OLED Display
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(15, 0);
  display.println("SMART BIN LEVELS");
  display.drawLine(0, 10, 128, 10, SH110X_WHITE);

  display.setCursor(0, 18);
  display.print("1. ORG  : "); display.print(pct1);
  if (pct1 >= 80) display.print("% FULL!"); else display.print(" %");

  display.setCursor(0, 33);
  display.print("2. PLAST: "); display.print(pct2);
  if (pct2 >= 80) display.print("% FULL!"); else display.print(" %");

  display.setCursor(0, 48);
  display.print("3. PAPER: "); display.print(pct3);
  if (pct3 >= 80) display.print("% FULL!"); else display.print(" %");

  display.display();
  delay(100);
}