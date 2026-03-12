import { expect } from 'chai';
import {
  isMultivalueDatabase,
  groupCollections,
  reorderCollectionsForGroupedView,
  type CollectionInfo,
} from './collection-grouping';

function coll(name: string): CollectionInfo {
  return { _id: name, name, type: 'collection' };
}

describe('collection-grouping', function () {
  describe('isMultivalueDatabase', function () {
    it('returns true when MD collection exists', function () {
      expect(isMultivalueDatabase(['CUSTOMERS', 'MD', 'INVOICES'])).to.be.true;
    });

    it('returns false when no MD collection', function () {
      expect(isMultivalueDatabase(['users', 'orders'])).to.be.false;
    });
  });

  describe('groupCollections', function () {
    it('groups DICT_X with X', function () {
      const groups = groupCollections([
        coll('CUSTOMERS'),
        coll('DICT_CUSTOMERS'),
      ]);
      expect(groups).to.have.length(1);
      expect(groups[0].name).to.equal('CUSTOMERS');
      expect(groups[0].dataCollection!.name).to.equal('CUSTOMERS');
      expect(groups[0].dictCollection!.name).to.equal('DICT_CUSTOMERS');
    });

    it('handles collections without DICT', function () {
      const groups = groupCollections([coll('ORDERS')]);
      expect(groups).to.have.length(1);
      expect(groups[0].name).to.equal('ORDERS');
      expect(groups[0].dictCollection).to.be.null;
    });

    it('handles orphan DICT (no data collection)', function () {
      const groups = groupCollections([coll('DICT_LEGACY')]);
      expect(groups).to.have.length(1);
      expect(groups[0].name).to.equal('LEGACY');
      expect(groups[0].dataCollection).to.be.null;
      expect(groups[0].dictCollection!.name).to.equal('DICT_LEGACY');
    });

    it('marks MD as standalone', function () {
      const groups = groupCollections([coll('CUSTOMERS'), coll('MD')]);
      const md = groups.find((g) => g.isMD);
      expect(md).to.not.be.undefined;
      expect(md!.name).to.equal('MD');
    });

    it('sorts MD first, then alphabetical', function () {
      const groups = groupCollections([
        coll('ZEBRA'),
        coll('ALPHA'),
        coll('MD'),
      ]);
      expect(groups[0].name).to.equal('MD');
      expect(groups[1].name).to.equal('ALPHA');
      expect(groups[2].name).to.equal('ZEBRA');
    });

    it('groups multi-level files under parent', function () {
      const groups = groupCollections([
        coll('TEMP-MASTER'),
        coll('TEMP-MASTER_1'),
        coll('TEMP-MASTER_2'),
        coll('DICT_TEMP-MASTER'),
      ]);
      expect(groups).to.have.length(1);
      expect(groups[0].name).to.equal('TEMP-MASTER');
      expect(groups[0].subFiles).to.have.length(2);
      expect(groups[0].subFiles[0].name).to.equal('TEMP-MASTER_1');
      expect(groups[0].subFiles[1].name).to.equal('TEMP-MASTER_2');
      expect(groups[0].dictCollection!.name).to.equal('DICT_TEMP-MASTER');
    });

    it('does not group _N suffix if parent does not exist', function () {
      const groups = groupCollections([coll('ARCHIVE_1'), coll('ARCHIVE_2')]);
      // No ARCHIVE collection exists, so these are standalone
      expect(groups).to.have.length(2);
    });

    it('sorts sub-files by numeric suffix', function () {
      const groups = groupCollections([
        coll('DATA'),
        coll('DATA_10'),
        coll('DATA_2'),
        coll('DATA_1'),
      ]);
      expect(groups[0].subFiles.map((s) => s.name)).to.deep.equal([
        'DATA_1',
        'DATA_2',
        'DATA_10',
      ]);
    });

    it('handles full multivalue database', function () {
      const groups = groupCollections([
        coll('CUSTOMERS'),
        coll('DICT_CUSTOMERS'),
        coll('INVOICES'),
        coll('DICT_INVOICES'),
        coll('MD'),
        coll('TEMP-WORK'),
        coll('TEMP-WORK_1'),
        coll('TEMP-WORK_2'),
      ]);
      expect(groups).to.have.length(4); // MD, CUSTOMERS, INVOICES, TEMP-WORK
      expect(groups[0].name).to.equal('MD');
      expect(groups[0].isMD).to.be.true;
      expect(groups[1].name).to.equal('CUSTOMERS');
      expect(groups[1].dictCollection).to.not.be.null;
      expect(groups[3].name).to.equal('TEMP-WORK');
      expect(groups[3].subFiles).to.have.length(2);
    });
  });

  describe('reorderCollectionsForGroupedView', function () {
    it('places DICT immediately after its data collection', function () {
      const input = [
        { name: 'CUSTOMERS' },
        { name: 'DICT_CUSTOMERS' },
        { name: 'DICT_INVOICES' },
        { name: 'INVOICES' },
        { name: 'MD' },
      ];
      const result = reorderCollectionsForGroupedView(input);
      const names = result.map((c) => c.name);
      // MD first, then alphabetical with DICT after data
      expect(names).to.deep.equal([
        'MD',
        'CUSTOMERS',
        'DICT_CUSTOMERS',
        'INVOICES',
        'DICT_INVOICES',
      ]);
    });

    it('places sub-files after parent', function () {
      const input = [{ name: 'DATA_2' }, { name: 'DATA' }, { name: 'DATA_1' }];
      const result = reorderCollectionsForGroupedView(input);
      expect(result.map((c) => c.name)).to.deep.equal([
        'DATA',
        'DATA_1',
        'DATA_2',
      ]);
    });

    it('preserves original objects', function () {
      const obj = { name: 'TEST', extra: 42 };
      const result = reorderCollectionsForGroupedView([obj]);
      expect(result[0]).to.equal(obj); // same reference
    });
  });
});
