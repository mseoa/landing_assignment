// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions/v1');
const {phone: phoneUtil} = require('phone');

// The Firebase Admin SDK to access Firestore.
const admin = require("firebase-admin");
admin.initializeApp();

let database = admin.database();

/**
 * newCustomerFunc - name, phone 입력 받아 ref 저장
 */
exports.newCustomerFunc = functions.https.onCall(async(data, context) => {
  // data: 클라이언트에서 전달한 데이터
  // context: 함수 호출에 대한 추가 정보 (사용자 인증, 사용자 UID 등)
    let { name, phone } = data
    let phoneInfo = phoneUtil(phone, { country: "KR" })
    if (!phoneInfo.isValid) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "invalid phoneNumber"
    );
  }

   // 이미 존재하는 phone인지 확인
    const snapshot = await database
        .ref("dev-team-landing/phonenumbers")
        .child(phoneInfo.phoneNumber)
        .once("value");

    if (snapshot.exists()) {
        throw new functions.https.HttpsError(
        "already-exists",
        "The phone number already exists."
    );
  }

    // Push ID 생성
    const newCustomerRef = database.ref("dev-team-landing/customers").push();
    const timestamp = new Date().getTime(); 

    // Push ID를 key로 사용하여 데이터 저장
    await newCustomerRef.set({
        name,
        phone,
        'created_at': timestamp,
        'updated_at': timestamp
    });

    // dev-team-landing/phonenumbers 노드에 데이터 저장
    await database.ref("dev-team-landing/phonenumbers")
        .child(phoneInfo.phoneNumber)
        .set({
            customerKey: newCustomerRef.key,
            name: name,
        });

    // 응답 데이터에 Push ID도 포함하여 반환
    return {
        key: newCustomerRef.key,
        name,
        phone,
        'created_at': timestamp,
        'updated_at': timestamp
    };
});


/**
 * triggerCustomerPhone - E.164포멧으로 변환하여 phone 저장
 */
exports.triggerCustomerPhone = functions.database.ref('dev-team-landing/customers/{key}').onCreate(
    async(snapshot, context)=>{
        let original = snapshot.val()
        let phoneInfo = phoneUtil(original.phone, {country: "KR"})

        return snapshot.ref.update({ 
            'national_phone': phoneInfo.phoneNumber
        })
    }
)

/**
 * searchFunc - phone 입력 받아 ref 검색하여 반환 
 */
exports.searchFunc = functions.https.onCall(async (data, context) => {
    const { phone } = data;

    let phoneInfo = phoneUtil(phone, {country: "KR"})

        if (!phoneInfo.isValid){
            throw new functions.https.HttpsError('invalid-argument', 'invalid phoneNumber');
        }
  
    // dev-team-landing/phonenumbers 노드를 검색하여 해당 번호가 있는지 확인
    const snapshot = await database
        .ref("dev-team-landing/phonenumbers")
        .child(phoneInfo.phoneNumber)
        .once("value");
  
    if (snapshot.exists()) {
        const data = snapshot.val();
        const { customerKey, name } = data;
        return { key: customerKey, name };
    } else {
        return null;
    }
  });