import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { initializeApp } from "firebase/app";
import { FirebaseApp } from 'firebase/app';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
// import {firebase} from 'firebase/app'
import 'firebase/firestore';
// import firebase from 'firebase/compat/app';
// import firestore from 'firebase/compat/app';
import { getFirestore } from "firebase/firestore";
import { collection } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit{
  title = 'webrtc';
  webcamActive: boolean = false;
  joinModalOpen: boolean = false;
  modalOpen: boolean = false;
  answerModalOpen: boolean = false;
  pc: any;
  clipboardClass: string = "bi bi-clipboard"
  servers = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  readonly firebaseConfig = {
    apiKey: "AIzaSyDWQQczCIqRxrK2EUbp-2OAz7M0OgL0TJY",
    authDomain: "ng-stage-1c99a.firebaseapp.com",
    projectId: "ng-stage-1c99a",
    storageBucket: "ng-stage-1c99a.appspot.com",
    messagingSenderId: "555774196304",
    appId: "1:555774196304:web:7afe8a96851ca2ca76af55",
    measurementId: "G-R1KPGYHD6Q"
  };

  app = initializeApp(this.firebaseConfig);
  analytics = getAnalytics(this.app);
  
  localStream!: MediaStream;
  remoteStream !: MediaStream;
  firestore: any;

  ngOnInit(): void {
    if (!firebase.apps.length) {
      firebase.initializeApp(this.firebaseConfig);
    }
    this.firestore = firebase.firestore();
    this.pc = new RTCPeerConnection(this.servers);
  }

  

// HTML elements
@ViewChild('webcamButton') webcamButton !: ElementRef;
@ViewChild('webcamVideo') webcamVideo !: ElementRef;
@ViewChild('callButton') callButton !: ElementRef;
@ViewChild('callInput') callInput !: ElementRef;
@ViewChild('answerInput') answerInput !: ElementRef;
@ViewChild('joinCall') joinCall !: ElementRef;
@ViewChild('answerButton') answerButton !: ElementRef;
@ViewChild('remoteVideo') remoteVideo !: ElementRef;
@ViewChild('hangupButton') hangupButton !: ElementRef;
@ViewChild('remoteContainer') remoteContainer !: ElementRef;
@ViewChild('localContainer') localContainer !: ElementRef;


// 1. Setup media sources

initWebcam = async () => {
  this.webcamActive = true;
  this.joinCall.nativeElement.disabled = false;
  this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  this.remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  this.localStream.getTracks().forEach((track) => {
    this.pc.addTrack(track, this.localStream);
  });

  // Pull tracks from remote stream, add to video stream
  this.pc.ontrack = (event : any) => {
    event.streams[0].getTracks().forEach((track: any) => {
      this.remoteStream.addTrack(track);
    });
  };

  this.webcamVideo.nativeElement.srcObject = this.localStream;
  this.remoteVideo.nativeElement.srcObject = this.remoteStream;

  // this.callButton.nativeElement.disabled = false;
  this.answerButton.nativeElement.disabled = false;
  // this.webcamButton.nativeElement.disabled = true;
};

// 2. Create an offer
call = async () => {
  // Reference Firestore collections for signaling
  const callDoc = this.firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  // this.callInput.nativeElement.value = callDoc.id;

  // Get candidates for caller, save to db
  this.pc.onicecandidate = (event: any) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  // Create offer
  const offerDescription = await this.pc.createOffer();
  await this.pc.setLocalDescription(offerDescription);
  this.callInput.nativeElement.value = callDoc.id;

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  // Listen for remote answer
  callDoc.onSnapshot((snapshot: any) => {
    const data: any = snapshot.data();
    if (!this.pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      this.pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add candidate to peer connection
  answerCandidates.onSnapshot((snapshot: any) => {
    snapshot.docChanges().forEach((change: any) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        this.pc.addIceCandidate(candidate);
      }
    });
  });

  this.hangupButton.nativeElement.disabled = false;
};

// 3. Answer the call with the unique ID
answerCall = async () => {
  //set flag here for starting loader as exe halts at awaits
  // position-absolute bottom-0 end-0 text-end
  this.hangupButton.nativeElement.disabled = false;
  this.localContainer.nativeElement.className = "position-absolute bottom-0 end-0 text-end ";
  this.webcamVideo.nativeElement.className = "w-25 z-index-999";

  const callId = this.answerInput.nativeElement.value;
  const callDoc = this.firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  this.pc.onicecandidate = (event: any) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData: any = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await this.pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await this.pc.createAnswer();
  await this.pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  //set flag here for ending loader
  // position-absolute bottom-0 end-0 text-end

  offerCandidates.onSnapshot((snapshot : any) => {
    console.log(this.remoteVideo);
    snapshot.docChanges().forEach((change : any) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        this.pc.addIceCandidate(new RTCIceCandidate(data));
        console.log('BAM! %cRTCIceCandidate added', 'font-size: 20px; color: red');
      }
    });
  });
  this.modalOpen = false;
};


answerModal = async () => {
  this.modalOpen = true;
  this.answerModalOpen = true;
  this.joinModalOpen = false;
}

join = () =>{
  this.modalOpen = true;
  this.joinModalOpen = true;
  this.answerModalOpen = false;
  this.call();
}

openModal = ()=>{
  // this.modalOpen = true;
}

closeModal = ()=>{
  this.modalOpen = false;
}

copyToClipboard = (element: HTMLInputElement) => {
  this.clipboardClass = "bi bi-clipboard-check-fill";             /** bootstrap icon class **/
  element.select();
  element.setSelectionRange(0, 99999);                            /** For mobile devices **/ 

  navigator.clipboard.writeText(element.value);                   /** Write the text to be copied on clipboard **/ 
}

hangUp = () => {
  this.localContainer.nativeElement.className = "w-100 text-center";
  this.webcamVideo.nativeElement.className = "w-100 res-height-100"
  this.initWebcam();
}




}
