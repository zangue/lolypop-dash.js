import FactoryMaker from '../../../core/FactoryMaker.js';
import Node from '../vo/Node.js';


/**
 * @author Armand Zangue
 */
function SortedSet() {

    let instance,
        head,
        tail,
        size;

    function setup() {
        head = null;
        tail = null;
        size = 0;
    }

    function insert(data) {
        let node = new Node();
        let curr;

        node.data = data;

        if (size === 0) {
            head = node;
            tail = node;

            size++;

            return node;
        }

        if (size === 1) {
            curr = head;

            if (node.data.value <= curr.data.value) {
                head = node;
            } else {
                tail = node;
            }

            head.next = tail;
            tail.prev = head;

            size++;

            return node;
        }

        // if smaller than head then new head
        if (node.data.value <= head.data.value) {
            head.prev = node;
            node.next = head;
            head = node;

            size++;

            return node;
        }

        // if greater than tail then new tail
        if (node.data.value >= tail.data.value) {
            node.prev = tail;
            tail.next = node;
            tail = node;

            size++;

            return node;
        }

        //else should inserted somewhere inbetween
        if (size > 0) {
            let count = 0;

            curr = head;

            while (count < size) {

                if (node.data.value <= curr.data.value) {
                    curr.prev.next = node;
                    node.prev = curr.prev;
                    node.next = curr;
                    curr.prev = node;

                    break;
                }

                curr = curr.next;
                count++;
            }
        }

        if (size < 0) {
            throw 'Negative list size!';
        }

        size++;

        return node;
    }

    function remove(node) {
        if (size === 0) {
            return;
        }

        if (size === 1 && node === tail) {
            head = null;
            tail = null;

            return;
        }

        if (size < 0) {
            throw 'Negative list size!';
        }

        // if head
        if (!node.prev) {
            node.next.prev = null;
            size--;

            return;
        }

        // if tail
        if (!node.next) {
            node.prev.next = null;
            size--;

            return;
        }

        // else
        node.prev.next = node.next;
        node.next.prev = node.prev;

        size--;

        return;
    }

    function filterOut(filter) {
        let count = 0;
        let curr = head;

        while (count < size) {

            if (filter(curr.data))
                remove(curr);

            curr = curr.next;
            count++;
        }
    }

    function countLeft(value) {
        let count = 0;
        let countl = 0;
        let curr = head;

        if (size === 0)
            return 0;

        while (count < size) {
            if (curr.data.value <= value)
                countl++;
            else
                break;

            curr = curr.next;
            count++;
        }

        return countl;
    }

    function countRight(value) {
        let count = 0;
        let countr = 0;
        let curr = tail;

        if (size === 0)
            return 0;

        while (count < size) {
            if (curr.data.value >= value)
                countr++;
            else
                break;

            curr = curr.prev;
            count++;
        }

        return countr;
    }

    function countLessOrEqual(value) {
        return countLeft(value);
    }

    function countGreaterOrEqual(value) {
        return countRight(value);
    }

    function count() {
        return size;
    }

    function dump() {
        let count = 0;
        let curr = head;
        let s = '';

        while (count < size && size > 0) {
            //console.log(curr.data.value);
            s += curr.data.value + ', ';
            curr = curr.next;
            count++;
        }

        console.log(s);
        console.log('Total size: ' + size);
    }

    function reset() {
        head = null;
        tail = null;
        size = 0;
    }

    instance = {
        insert: insert,
        remove: remove,
        filterOut: filterOut,
        countLeft: countLeft,
        countRight: countRight,
        countLessOrEqual: countLessOrEqual,
        countGreaterOrEqual: countGreaterOrEqual,
        count: count,
        dump: dump,
        reset: reset
    };

    setup();

    return instance;
}

SortedSet.__dashjs_factory_name = 'SortedSet';
export default FactoryMaker.getClassFactory(SortedSet);