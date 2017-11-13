// @flow

import defer from 'golike-defer'
import { cancelable } from 'promise-toolbox'
import { forEach } from 'lodash'

import { asyncMap, safeDateFormat } from './utils'
import { createPredicate } from './value-matcher'
import { parseDateTime } from './xapi/utils'

type Schedule = {|
  cron: string,
  exportRetention: number,
  id: string,
  snapshotRetention: number,
  timezone?: string
|};

type Backup = {|
  id: string,
  remotes: Array<string>
  schedules: Array<Schedule>,
  srs: Array<string>,
  useDelta?: boolean,
  vms: Array<string>,
  vmsFilter: any,
|};

const backup: Backup = {
  id: 'db3ef616-c8b6-43c7-b8de-ded103359bd7',
  remotes: ['93dcfb44-d10b-4213-8be8-4093ffdec009'],
  schedules: [
    {
      cron: '@daily',
      exportRetention: 3,
      id: 'bb27848e-9d4a-4c8d-ae09-21b5cbe33240',
      snapshotRetention: 0,
      timezone: 'Europe/Paris',
    },
    {
      id: 'fd79636e-2316-4e73-b6f0-2acd395b6d17',
      cron: '@weekly',
      snapshotRetention: 0,
    },
  ],
  srs: ['65dc0132-67a1-eec4-d074-d9d95d4ea32f'],
  useDelta: true,
  vms: ['cefedac7-1bd1-2371-8d6f-b78a4ae9d4f7'],
}

const BACKUPS_PATH = 'xo-vm-backups'

const compareSnapshotTime = (
  { snapshot_time: time1 },
  { snapshot_time: time2 }
) => (time1 < time2 ? -1 : 1)

const getOldEntries = (retention, entries) =>
  retention === 0 ? entries : entries.slice(0, -retention)

export default class Backup2 {
  constructor (app) {
    this._app = app

    app.on('start', async () => {
      // migrate old jobs
    })
  }

  async doBackup (backup: Backup, schedule: schedule) {

  }

  // - [x] files (.tmp) should be renamed at the end of job
  // - [ ] validate VHDs after exports and before imports
  // - [ ] protect against concurrent backup against a single VM
  // - [ ] detect full remote
  // - [x] can the snapshot and export retention be different? → Yes
  @cancelable
  @defer
  async _backupVm ($defer, $cancelToken, vmId: string, backup: Backup, schedule: Schedule) {
    const xapi = this._app.getXapi(vmId)
    const vm = xapi.getObject(vmId)

    const { id: backupId, remotes, srs } = backup
    const { id: scheduleId, exportRetention, snapshotRetention } = schedule

    const willExport = remotes.length === 0 && srs.length === 0

    if (exportRetention === 0) {
      if (snapshotRetention === 0) {
        throw new Error('export and snapshots retentions cannot both be 0')
      }
    } else if (willExport) {
      throw new Error('export retention must be 0 without remotes and SRs')
    }

    const vmSnapshot = await xapi._snapshotVm($cancelToken, vm)
    $defer.onFailure.call(xapi, '_deleteVm', vmSnapshot)
    await xapi._updateObjectMapProperty(vm, 'other_config', {
      'xo:backup': backupId,
      'xo:backup:schedule': scheduleId,
    })

    await asyncMap(
      getOldEntries(
        filter(
          vm.$snapshots,
          ({ other_config: cfg }) =>
            cfg['xo:backup'] === backupId &&
            cfg['xo:backup:schedule'] === scheduleId
        ).sort(compareSnapshotTime),
        previousSnapshots
      ),
      snapshot => xapi.deleteVm(snapshot)
    )

    if (!willExport) {
      return
    }

    const { useDelta } = backup
    if (!useDelta) {
      const xva = await xapi.exportVm($cancelToken, vmSnapshot)
      const now = Date.now()

      const basename = `${safeDateFormat(now)}-${vm.uuid}`
      const dataBasename = `${dataFile}.xva`
      const dataFilename = `${BACKUPS_PATH}/${dataBasename}`
      const tmpFilename = `${BACKUPS_PATH}/.${dataBasename}`
      const metadataFilename = `${BACKUPS_PATH}/${dataFile}.json`
      const metadata = JSON.stringify({
        data: `./${dataBasename}`,
        timestamp: now,
        type: 'xva',
        version: '2.0.0',
        vm,
        vmSnapshot,
      })
      await Promise.all([
        asyncMap(
          remotes,
          defer(async ($defer, remoteId) => {
            const fork = xva.pipe(new PassThrough())

            const handler = this._app.getRemoteHandler(remoteId)
            $defer.onSuccess.call(handler, 'outputFile', metadataFilename, metadata)

            const output = await handler.createOutputStream(tmpFilename, {
              checksum: true,
            })
            $defer.onFailure.call(handler, 'unlink', tmpFilename)
            $defer.onSuccess.call(handler, 'rename', tmpFilename, dataFilename)

            const promise = fromEvent(output, 'finish')
            fork.pipe(output)

            return promise
          })
        ),
        asyncMap(
          srs,
          ($defer, srId) => {
            const fork = xva.pipe(new PassThrough())

            const xapi = this._app.getXapi(srId)
            const sr = xapi.getObject(srId)
            return xapi._importVm($cancelToken, xva, sr, false)
          }
        )
      ])

      if (snapshotRetention === 0) {
        await xapi.deleteVm(vmSnapshot)
      }

      return
    }


  }
}
