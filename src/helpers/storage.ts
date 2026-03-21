import { extname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { diskStorage } from 'multer'
import { v4 as uuid } from 'uuid'
import { HttpException, HttpStatus } from '@nestjs/common'
import { Request } from 'express'

export const MAX_PROFILE_PICTURE_SIZE_IN_BYTES = 10 * 1024 * 1024
// Multer configuration
export const multerConfig = {
    dest: './uploads'
}

// Multer upload options
/* 
Paramters:
    mimeValidation: RegExp "/\/(jpg|jpeg|png)$/"
    destPath: string
    filenameCb?: (req: any, file: any) => string
*/

export const UploadOption = (
    mimeValidation: RegExp,
    destPath: string,
    filenameCb?: (req: any, file: any) => string
) => {
    // Enable file size limits
    const limits = {
        fileSize: 20 * 1024 * 1000
    }
    // Check the mimetypes to allow for upload
    const fileFilter = (req: any, file: any, cb: any) => {
        if (file.mimetype.match(mimeValidation)) {
            // Allow storage of file
            cb(null, true)
        } else {
            // Reject file
            cb(
                new HttpException(
                    `Unsupported file type ${extname(file.originalname)}`,
                    HttpStatus.BAD_REQUEST
                ),
                false
            )
        }
    }

    // Storage properties
    const storage = diskStorage({
        // Destination storage path details
        destination: (req: Request, file: Express.Multer.File, cb: any) => {
            const uploadPath = destPath
            // Create folder if doesn't exist
            if (!existsSync(uploadPath)) {
                mkdirSync(uploadPath)
            }
            cb(null, uploadPath)
        },
        // File modification details
        filename: (req: Request, file: Express.Multer.File, cb: any) => {
            // Calling the callback passing the random name generated with the original extension name
            const filename = filenameCb
                ? filenameCb(req, file)
                : `${uuid()}${extname(file.originalname)}`
            cb(null, filename)
        }
    })

    return {
        limits,
        fileFilter,
        storage
    }
}
