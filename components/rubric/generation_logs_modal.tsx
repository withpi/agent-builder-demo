import { AnimatePresence, motion } from 'motion/react';
import { Dialog, DialogPanel, DialogTitle, Label, Field } from '@headlessui/react';
import React, { ReactNode, useState } from 'react';
import {
  GenerateScorerSystemMessage,
  GenerateScorerUserMessage,
} from '@/lib/rubric/rubricActions';
import { ProgressCircle } from '@/components/tremor/progress_circle';
import {GenerateScorerStatusIcon} from "@/components/rubric/generate_scorer_status_icon";
import {ArtifactButton} from "@/components/rubric/artifact_button";

function SystemMessage({
  systemMessage,
  isLoading,
  index,
}: {
  systemMessage: GenerateScorerSystemMessage;
  isLoading: boolean;
  index: number;
}) {
  return (
    <div className={'flex gap-2'}>
      <div>
        {isLoading ? (
          <div className={'mt-1'}>
            <ProgressCircle className="size-4 animate-spin" strokeWidth={10} value={30} />
          </div>
        ) : (
          <div className={'w-6 pt-1 pl-1 text-left font-mono text-xs text-gray-500'}>{index}</div>
        )}
      </div>
      <div className={'max-w-md'}>{systemMessage.message}</div>
    </div>
  );
}
export function GenerationLogsModal({
  isOpen,
  setIsOpen,
  userMessage,
  systemMessages,
  isLast,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userMessage: GenerateScorerUserMessage;
  systemMessages: GenerateScorerSystemMessage[];
  isLast: boolean;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog static open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30"
          />
          <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
            <DialogPanel
              as={motion.div}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="2xl rounded-lg bg-white p-6"
            >
              <DialogTitle className="text-lg font-semibold">
                <div>
                  <div className={'mb-1 text-xs font-medium text-gray-500'}>GENERATION STEP</div>
                  <div className={'flex items-center gap-2'}>
                    <GenerateScorerStatusIcon
                      className={'p-0'}
                      status={userMessage}
                      isLast={isLast}
                    />
                    <div>{userMessage?.message}</div>
                  </div>
                </div>
              </DialogTitle>
              <div className={'mt-2 max-h-[70vh] space-y-2 overflow-y-auto'}>
                {systemMessages.map((systemMessage, i) => (
                  <SystemMessage
                    index={i}
                    systemMessage={systemMessage}
                    key={systemMessage.message}
                    isLoading={isLast && i == systemMessages.length - 1}
                  />
                ))}
              </div>
              <div className={'flex items-center'}>
                <ArtifactButton onClick={() => setIsOpen(false)}>Close</ArtifactButton>
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
