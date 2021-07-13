import test from "ava";
import Listenable from "../src/Listenable.js";

const EVENT = "myEvent";
const EVENT_2 = "myEvent2";

test("Listener is triggered on event", test => {
    const myListenable = new Listenable();
    myListenable.on(EVENT, () => test.pass());
    myListenable.trigger(EVENT);
});

test("Listener should not trigger for wrong event", test => {
    const myListenable = new Listenable();
    myListenable.on(EVENT, () => test.fail());
    myListenable.trigger(EVENT_2);
    test.pass();
});

test("Event should propagate to next listener", test => {
    const myListenable = new Listenable();
    const myListenable2 = new Listenable();
    myListenable.nextListenable = myListenable2;
    myListenable2.on(EVENT, () => test.pass());
    myListenable.trigger(EVENT);
});

test("Promise type listeners are triggered", test => {
    const myListenable = new Listenable();
    const myListenable2 = new Listenable();
    myListenable.nextListenable = myListenable2;
    let promise = myListenable2.when(EVENT).then(() => test.pass());
    myListenable.triggerOnce(EVENT);
    return promise;
});
