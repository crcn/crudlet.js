import { expect } from "chai";
import { timeout } from "../test";
import { pipe, through, readAll, createQueue } from "./utils";

(Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol("Symbol.asyncIterator");

describe(__filename + "#", () => {
  describe("through#", () => {
    it("can be used with a vanilla adder function", async () => {
      const iter = through((value: number) => value + 1);
      console.log("NEXT");
      expect((await iter.next(1)).value).to.eql(2);
      console.log("NEXT");
      expect((await iter.next(2)).value).to.eql(3);
    });

    it("yields all results from target function to iterator", async () => {

      const iter = through(function*(amount: number) {
        for (let i = amount; i--;) {
          yield i;
        }
      });

      expect((await iter.next(5)).value).to.eql(4);
      expect((await iter.next()).value).to.eql(3);
      expect((await iter.next()).value).to.eql(2);
      expect((await iter.next()).value).to.eql(1);
      expect((await iter.next()).value).to.eql(0);
    });

    it("finishes if there are no more inputs", async () => {

      const iter = through(function*(amount: number) {
        for (let i = amount; i--;) {
          yield i;
        }
      });

      expect((await iter.next(2)).value).to.eql(1);
      expect((await iter.next()).value).to.eql(0);
      expect((await iter.next()).done).to.eql(true);
      expect((await iter.next()).done).to.eql(true);
    });


    it("finishes yielding the current through iterator before running the next", async () => {

      const iter = through(function*(amount: number) {
        for (let i = amount; i--;) {
          yield i;
        }
      });

      expect((await iter.next(4)).value).to.eql(3);
      expect((await iter.next(3)).value).to.eql(2);
      expect((await iter.next()).value).to.eql(1);
      expect((await iter.next()).value).to.eql(0);
      expect((await iter.next()).value).to.eql(2);
      expect((await iter.next()).value).to.eql(1);
      expect((await iter.next()).value).to.eql(0);
      expect((await iter.next()).done).to.eql(true);
    });

    it("can keep open", async () => {

      const iter = through(function*(amount: number) {
        for (let i = amount; i--;) {
          console.log('YIELDING', amount, i);
          yield i;
        }
      }, true);

      expect((await iter.next(2)).value).to.eql(1);
      expect((await iter.next()).value).to.eql(0);
      console.log('GETTING NEXT');
      const p  = iter.next();
      console.log('NEXTING WITH THREEEEE');
      const p2 = iter.next(3);
      console.log('awaiting P1');
      expect((await p).value).to.eq(2);
      console.log('awaiting P2');
      expect((await p2).value).to.eql(2);
      console.log('AWATING');
      expect((await iter.next()).value).to.eql(1);
      console.log('ZEO');
      expect((await iter.next()).value).to.eql(0);

    });

    it("pom pom", async () => {

      async function* a() {
        yield await Promise.resolve(1);
        yield await Promise.resolve(2);
        yield await Promise.resolve(3);
        yield await Promise.resolve(4);
      }

      const it = a();
      it.next().then((a) => {
        console.log(a);
      });
      it.next().then((a) => {
        console.log(a);
      });
      it.next().then((a) => {
        console.log(a);
      });
      it.next().then((a) => {
        console.log(a);
      });
      it.next().then((a) => {
        console.log(a);
      });

    });
  });

  describe("pipe#", () => {
    it("can use a pipeline with just one iterator", async function() {
      const pipeline = pipe(
        (async function*() {
          let i = 0;
          while(true) {
            i = yield i + 1;
          }
        })()
      );

      expect((await pipeline.next(1)).value).to.eql(1);
      expect((await pipeline.next(2)).value).to.eql(3);
      expect((await pipeline.next(3)).value).to.eql(4);
      expect((await pipeline.next(4)).value).to.eql(5);
    });

    it("can pipe with a through call", async function() {
      const pipeline = pipe(
        through((v: number) => v + 1)
      );
      expect((await pipeline.next(1)).value).to.eq(2);
      expect((await pipeline.next(5)).value).to.eq(6);
      expect((await pipeline.next()).done).to.eq(true);
    });
    
    it("can pipe with multiple throughs", async function() {
      const pipeline = pipe(
        through((v: string) => String(v).toUpperCase()),
        through((v: string) => `${v}!`),
        through((v: string) => `${v}!!??`)
      );
      expect((await pipeline.next("one")).value).to.eq("ONE!!!??");
      expect((await pipeline.next("five")).value).to.eq("FIVE!!!??");
      expect((await pipeline.next()).done).to.eq(true);
    });

    it("can use an array as an argument", async function() {
      const pipeline = pipe(
        [1, 2, 3, 4],
        through((v: number) => -v)
      );
      
      expect((await pipeline.next()).value).to.eq(-1);
      expect((await pipeline.next()).value).to.eq(-2);
      expect((await pipeline.next()).value).to.eq(-3);
      expect((await pipeline.next()).value).to.eq(-4);
      expect((await pipeline.next()).done).to.eq(true);
    });

    it("can be used in conjuction with readAll", async function() {
      expect(await readAll(pipe([1, 2, 3], through(v => -v)))).to.eql([-1, -2, -3]);
    });
  });

  describe("queue#", () => {
    it("can push & pop items", async function() {
      const queue = createQueue<number>();

      queue.unshift(1);

      expect((await queue.next()).value).to.eql(1);
      
      queue.unshift(2);
      queue.unshift(3);
      expect((await queue.next()).value).to.eql(2);
      expect((await queue.next()).value).to.eql(3);
    });

    it("can use the queue as an async iterable iterator", async function() {
      const queue = createQueue<number>();
      queue.unshift(1);
      queue.unshift(2);
      queue.unshift(3);
      queue.done();

      const buffer = [];
      for await (const value of queue) {
        buffer.push(value);
      }

      expect(buffer).to.eql([1, 2, 3]);
    });
    

    it("next() waits for unshift()", function() {
      const {next, unshift} = createQueue<number>();

      const p = (async (resolve, reject) => {
        expect((await next()).value).to.eql(1);
        expect((await next()).value).to.eql(2);
      })();

      unshift(1);
      unshift(2);

      return p;
    });

    it("push waits for pop", async function() {
      const {next, unshift} = createQueue<number>();
      let c = 0;
      const p = (async () => {
        await unshift(1);
        c++;
        await unshift(2);
        c++;
      })();
      await timeout();
      expect(c).to.eql(0);
      expect(await next()).to.eql({ value: 1, done: false });
      await timeout();
      expect(c).to.eql(1);
      expect(await next()).to.eql({ value: 2, done: false });
      await timeout();
      expect(c).to.eql(2);
    });
  });
});