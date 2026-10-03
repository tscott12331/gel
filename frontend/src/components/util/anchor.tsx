interface IAnchorProps extends React.ComponentProps<'a'>{}

export default function Anchor({
    children,
    ...rest
}: IAnchorProps) {
    return (
        <a
            {...rest}
            target='_blank'
            className="underline text-chatter-accent-bright visited:text-chatter-accent focus-visible:outline focus-visible:outline-chatter-accent focus-visible:outline-offset-2 cursor-pointer"
        >
            {children}
        </a>
    )
}
